import uuid
from datetime import timedelta
from concurrent.futures import ThreadPoolExecutor

import pytest
from django.db import connection, close_old_connections
from django.utils import timezone
from rest_framework.exceptions import ValidationError, Throttled
from rest_framework_simplejwt.tokens import AccessToken

from apps.accounts import whatsapp
from apps.accounts.models import Church, User, WhatsAppIdentity, WhatsAppChallenge, WhatsAppSendLimit
from apps.members.models import Member

pytestmark = pytest.mark.django_db
PHONE = "+553499886209"


@pytest.fixture
def sender(settings, church, monkeypatch):
    settings.WHATSAPP_AUTH_ENABLED = True
    settings.WHATSAPP_AUTH_CHURCH_ID = church.pk
    sent = []
    monkeypatch.setattr(whatsapp, "send_code", lambda phone, code: sent.append((phone, code)))
    return sent


def challenge(sender, phone=PHONE, **kwargs):
    identifier = whatsapp.request_code(phone, "192.0.2.1", **kwargs)
    return identifier, sender[-1][1]


def test_request_does_not_expose_code_and_accepts_local_format(api_client, sender):
    result = api_client.post('/api/auth/whatsapp/request/', {'phone': '(34) 9988-6209'})
    assert result.status_code == 200
    assert set(result.data) == {'challenge', 'expires_in', 'resend_in'}
    assert len(sender[0][1]) == 6 and sender[0][1].isdigit()
    row = WhatsAppChallenge.objects.get(pk=result.data['challenge'])
    assert row.phone == PHONE and row.code_digest != sender[0][1]
    assert not row.proof_digest


@pytest.mark.parametrize('phone', ['abc', '', '+1 2025550123', '5510999999999', '5511888888888', '5511999999999@g.us'])
def test_invalid_numbers_rejected(phone, sender):
    with pytest.raises(ValidationError): whatsapp.request_code(phone, '192.0.2.1')
    assert not sender


def test_code_registers_only_visitor_and_not_existing_member(api_client, sender, make_member):
    existing = make_member('Mesmo Nome', email='visitor@example.com', phone=PHONE)
    identifier, code = challenge(sender)
    verified = api_client.post('/backend/auth/whatsapp/verify/', {'challenge': str(identifier), 'code': code})
    assert verified.status_code == 200 and verified.data['registration_required']
    result = api_client.post('/backend/auth/whatsapp/register/', {'proof': verified.data['proof'], 'name': 'Nova Pessoa', 'email': 'visitor@example.com', 'role': 'admin', 'church': 999})
    assert result.status_code == 201
    user = User.objects.get(email='visitor@example.com')
    assert user.role == 'member' and not user.is_staff and not user.is_superuser and not user.has_usable_password()
    assert user.member_profile.status == Member.Status.VISITOR
    assert WhatsAppIdentity.objects.get(user=user).phone == PHONE
    existing.refresh_from_db()
    assert existing.user_id is None
    assert int(AccessToken(result.data['access'])['user_id']) == user.pk
    assert api_client.post('/backend/auth/whatsapp/register/', {'proof': verified.data['proof'], 'name': 'Outra Pessoa', 'email': 'other@example.com'}).status_code == 400


def test_failed_attempts_persist_and_lock_correct_code(sender):
    identifier, code = challenge(sender)
    wrong = '111111' if code != '111111' else '222222'
    for _ in range(5):
        with pytest.raises(ValidationError): whatsapp.verify_code(identifier, wrong)
    assert WhatsAppChallenge.objects.get(pk=identifier).attempts == 5
    with pytest.raises(ValidationError): whatsapp.verify_code(identifier, code)


def test_expired_unknown_tampered_and_replayed_code(sender):
    identifier, code = challenge(sender)
    with pytest.raises(ValidationError): whatsapp.verify_code(uuid.uuid4(), code)
    WhatsAppChallenge.objects.filter(pk=identifier).update(expires_at=timezone.now()-timedelta(seconds=1))
    with pytest.raises(ValidationError): whatsapp.verify_code(identifier, code)


def test_verified_identity_logs_into_existing_account_and_replay_rejected(sender, make_user, church):
    user = make_user('existing@example.com', role='treasurer')
    WhatsAppIdentity.objects.create(user=user, church=church, phone=PHONE)
    identifier, code = challenge(sender)
    result = whatsapp.verify_code(identifier, code)
    assert int(AccessToken(result['access'])['user_id']) == user.pk
    with pytest.raises(ValidationError): whatsapp.verify_code(identifier, code)


def test_contact_phone_does_not_grant_existing_account_access(sender, make_user):
    user = make_user('admin@example.com', role='admin', phone=PHONE)
    identifier, code = challenge(sender)
    result = whatsapp.verify_code(identifier, code)
    assert result['registration_required'] and 'access' not in result
    with pytest.raises(ValidationError): whatsapp.register_account(result['proof'], 'Intruso', user.email)
    assert not WhatsAppIdentity.objects.filter(user=user).exists()


def test_link_requires_authenticated_owner_and_code(sender, api_client, make_user, church):
    owner = make_user('owner@example.com', role='admin')
    other = make_user('other@example.com')
    assert api_client.post('/api/auth/whatsapp/link/request/', {'phone': PHONE}).status_code == 401
    identifier, code = challenge(sender, purpose='link', user=owner)
    with pytest.raises(ValidationError): whatsapp.verify_code(identifier, code, other)
    with pytest.raises(ValidationError): whatsapp.verify_code(identifier, code)
    assert whatsapp.verify_code(identifier, code, owner) == {'linked': True}
    assert WhatsAppIdentity.objects.get(user=owner).church == church
    owner.refresh_from_db()
    assert owner.phone == PHONE and owner.role == 'admin'


def test_link_cannot_replace_someone_elses_identity(sender, make_user, church):
    owner = make_user('owner@example.com')
    other = make_user('other@example.com')
    WhatsAppIdentity.objects.create(user=other, church=church, phone=PHONE)
    identifier, code = challenge(sender, purpose='link', user=owner)
    with pytest.raises(ValidationError): whatsapp.verify_code(identifier, code, owner)
    assert not WhatsAppIdentity.objects.filter(user=owner).exists()


def test_disabled_account_and_foreign_church_cannot_login(sender, make_user, church):
    user = make_user('disabled@example.com', is_active=False)
    WhatsAppIdentity.objects.create(user=user, church=church, phone=PHONE)
    identifier, code = challenge(sender)
    with pytest.raises(ValidationError): whatsapp.verify_code(identifier, code)


def test_identity_does_not_follow_user_to_other_church(sender, make_user, church):
    user = make_user('moved@example.com')
    WhatsAppIdentity.objects.create(user=user, church=church, phone=PHONE)
    user.church = Church.objects.create(name='Outra Igreja')
    user.save()
    identifier, code = challenge(sender)
    with pytest.raises(ValidationError): whatsapp.verify_code(identifier, code)


def test_resend_supersedes_previous_code(sender):
    first, old_code = challenge(sender)
    WhatsAppSendLimit.objects.update(last_sent=timezone.now()-timedelta(minutes=2))
    second, new_code = challenge(sender)
    with pytest.raises(ValidationError): whatsapp.verify_code(first, old_code)
    assert whatsapp.verify_code(second, new_code)['registration_required']


@pytest.mark.django_db(transaction=True)
def test_concurrent_registration_consumes_proof_once(sender, church):
    if connection.vendor != 'postgresql': pytest.skip('Row locks require PostgreSQL')
    identifier, code = challenge(sender)
    proof = whatsapp.verify_code(identifier, code)['proof']
    def register(n):
        close_old_connections()
        try:
            return 'access' in whatsapp.register_account(proof, 'Pessoa Teste', f'concurrent{n}@example.com')
        except ValidationError: return False
        finally: close_old_connections()
    with ThreadPoolExecutor(max_workers=2) as pool:
        assert list(pool.map(register, [0,1])).count(True) == 1
    assert WhatsAppIdentity.objects.filter(church=church, phone=PHONE).count() == 1


def test_proof_expires_and_unverified_proof_rejected(sender):
    identifier, code = challenge(sender)
    result = whatsapp.verify_code(identifier, code)
    WhatsAppChallenge.objects.filter(pk=identifier).update(proof_expires_at=timezone.now()-timedelta(seconds=1))
    for proof in [result['proof'], 'x'*43]:
        with pytest.raises(ValidationError): whatsapp.register_account(proof, 'Pessoa Teste', 'test@example.com')


def test_cooldown_and_hourly_limits_are_shared(sender, church):
    challenge(sender)
    with pytest.raises(Throttled): challenge(sender)
    WhatsAppSendLimit.objects.update(last_sent=timezone.now()-timedelta(minutes=2), count=5)
    with pytest.raises(Throttled): challenge(sender)
    assert len(sender) == 1


def test_send_failure_leaves_no_usable_challenge(sender, monkeypatch):
    monkeypatch.setattr(whatsapp, 'send_code', lambda *_: (_ for _ in ()).throw(RuntimeError('secret provider error')))
    with pytest.raises(whatsapp.ProviderUnavailable) as error: challenge(sender)
    assert 'secret' not in str(error.value)
    assert not WhatsAppChallenge.objects.exists()
    assert WhatsAppSendLimit.objects.filter(count=1).count() == 3


def test_disabled_provider_never_sends(api_client, sender, settings):
    settings.WHATSAPP_AUTH_ENABLED = False
    assert api_client.post('/api/auth/whatsapp/request/', {'phone': PHONE}).status_code == 503
    assert not sender


@pytest.mark.django_db(transaction=True)
def test_concurrent_code_consumption_has_one_winner(sender, church, make_user):
    if connection.vendor != 'postgresql': pytest.skip('Row locks require PostgreSQL')
    user = make_user('concurrent@example.com')
    WhatsAppIdentity.objects.create(user=user, church=church, phone=PHONE)
    identifier, code = challenge(sender)
    def verify(_):
        close_old_connections()
        try:
            return 'access' in whatsapp.verify_code(identifier, code)
        except ValidationError:
            return False
        finally: close_old_connections()
    with ThreadPoolExecutor(max_workers=2) as pool:
        assert list(pool.map(verify, [0,1])).count(True) == 1
