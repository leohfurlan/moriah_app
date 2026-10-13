import pytest
from django.utils import timezone
from apps.accounts.models import Church
from apps.events.models import Event
from apps.members.models import Member

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize('field', ['member', 'event'])
def test_foreign_reference_rejected_on_create_and_patch(api_client, make_user, church, field):
    user = make_user('finance-security@example.invalid', role='treasurer')
    foreign = Church.objects.create(name='Foreign')
    person = Member.objects.create(church=foreign, full_name='Foreign private name')
    event = Event.objects.create(church=foreign, name='Foreign private event', start_at=timezone.now())
    api_client.force_authenticate(user=user)
    body = dict(entry_type='expense', description='Own expense', amount='1.00', due_date='2026-10-12')
    path = '/backend/finance/entries/'
    created = api_client.post(path, body, format='json')
    assert created.status_code == 201
    foreign_id = person.pk if field == 'member' else event.pk
    for response in (api_client.post(path, {**body, field: foreign_id}, format='json'),
                     api_client.patch(f'{path}{created.data["id"]}/', {field: foreign_id}, format='json')):
        assert response.status_code == 400
        assert 'Foreign private' not in str(response.data)
    own = Member.objects.create(church=church, full_name='Own member') if field == 'member' else Event.objects.create(church=church, name='Own event', start_at=timezone.now())
    assert api_client.patch(f'{path}{created.data["id"]}/', {field: own.pk}, format='json').status_code == 200
    assert api_client.patch(f'{path}{created.data["id"]}/', {field: None}, format='json').status_code == 200
