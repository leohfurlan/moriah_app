import pytest
from django.core.management import call_command
from apps.accounts.models import Church, User
from apps.audit.models import Notification, AuditLog
from apps.members.models import MemberLinkRequest, Member
from apps.members.linking import open_request, review_request, LinkConflict

pytestmark = pytest.mark.django_db


def test_admin_self_request_notifies_and_lists_without_member(api_client, make_user):
    admin = make_user('admin@test.com', role=User.Role.ADMIN)
    api_client.force_authenticate(admin)
    result = api_client.post('/api/me/member-link-requests/', {})
    assert result.status_code == 201
    assert api_client.post('/api/me/member-link-requests/', {}).status_code == 200
    assert MemberLinkRequest.objects.count() == 1
    notice = Notification.objects.get(recipient=admin)
    assert notice.action_route == f'/member-link-requests/{result.data["id"]}'
    assert api_client.get('/api/member-link-requests/').data[0]['id'] == result.data['id']


def test_approval_is_audited_idempotent_and_does_not_grant_roles(api_client, make_user, make_member):
    user = make_user('new@test.com')
    secretary = make_user('secretary@test.com', role=User.Role.SECRETARY)
    item, _ = open_request(user)
    candidate = make_member('Cadastro correto')
    api_client.force_authenticate(secretary)
    data = {'decision':'approved', 'candidate_member':candidate.pk}
    url = f'/api/member-link-requests/{item.pk}/review/'
    assert api_client.post(url, data).status_code == 200
    assert api_client.post(url, data).status_code == 200
    candidate.refresh_from_db(); user.refresh_from_db(); item.refresh_from_db()
    assert candidate.user_id == user.pk and user.role == 'member'
    assert item.reviewed_by == secretary and item.reviewed_at
    assert Notification.objects.filter(recipient=user).count() == 1
    assert AuditLog.objects.filter(action='member_link_approved').count() == 1
    assert api_client.post(url, {'decision':'rejected','review_notes':'Outra decisão'}).status_code == 409


def test_reject_requires_reason_and_allows_new_request(api_client, make_user):
    user = make_user('new@test.com'); admin = make_user('admin@test.com', role='admin')
    item, _ = open_request(user)
    api_client.force_authenticate(admin)
    url = f'/api/member-link-requests/{item.pk}/review/'
    assert api_client.post(url, {'decision':'rejected'}).status_code == 400
    assert api_client.post(url, {'decision':'rejected','review_notes':'Cadastro não localizado'}).status_code == 200
    api_client.force_authenticate(user)
    assert api_client.get('/api/me/member-link-requests/').data[0]['review_notes'] == 'Cadastro não localizado'
    assert api_client.post('/api/me/member-link-requests/', {}).status_code == 201


def test_permissions_scope_and_candidate_protection(api_client, make_user, make_member):
    admin = make_user('admin@test.com', role='admin'); user = make_user('user@test.com')
    item, _ = open_request(user)
    other = Church.objects.create(name='Outra igreja')
    foreign_admin = User.objects.create_user(username='foreign', email='foreign@test.com', church=other, role='admin')
    candidate = Member.objects.create(church=other, full_name='Outro cadastro')
    api_client.force_authenticate(user)
    assert api_client.get('/api/member-link-requests/').status_code == 403
    assert api_client.post(f'/api/member-link-requests/{item.pk}/review/', {'decision':'approved','candidate_member':candidate.pk}).status_code == 403
    api_client.force_authenticate(foreign_admin)
    assert api_client.get(f'/api/member-link-requests/{item.pk}/').status_code == 404
    assert api_client.get('/api/member-link-requests/').data == []
    api_client.force_authenticate(admin)
    assert api_client.post(f'/api/member-link-requests/{item.pk}/review/', {'decision':'approved','candidate_member':candidate.pk}).status_code == 400
    occupied = make_member('Ocupado', user=make_user('occupied@test.com'))
    assert api_client.post(f'/api/member-link-requests/{item.pk}/review/', {'decision':'approved','candidate_member':occupied.pk}).status_code == 409
    assert api_client.get(f'/api/member-link-requests/{item.pk}/candidates/').data == []


def test_recovery_dry_run_and_deduplication(make_user, church):
    admin = make_user('admin@test.com', role='admin')
    MemberLinkRequest.objects.create(church=church, user=admin, requested_email=admin.email)
    call_command('recover_member_link_notifications', church_id=church.pk, dry_run=True)
    assert Notification.objects.count() == 0
    call_command('recover_member_link_notifications', church_id=church.pk)
    call_command('recover_member_link_notifications', church_id=church.pk)
    assert Notification.objects.count() == 1
    assert MemberLinkRequest.objects.get().status == 'pending'


def test_second_request_cannot_take_already_linked_candidate(make_user, make_member):
    admin = make_user('admin@test.com', role='admin')
    first, _ = open_request(make_user('first@test.com'))
    second, _ = open_request(make_user('second@test.com'))
    candidate = make_member('Disputado')
    review_request(admin, first.pk, 'approved', candidate.pk)
    with pytest.raises(LinkConflict):
        review_request(admin, second.pk, 'approved', candidate.pk)
    second.refresh_from_db()
    assert second.status == 'pending'


@pytest.mark.django_db(transaction=True)
def test_concurrent_opening_has_one_pending_and_one_notice(make_user):
    from django.db import connection
    if connection.vendor != "postgresql":
        pytest.skip("Row-lock concurrency requires PostgreSQL; covered by the PostgreSQL CI job")
    from concurrent.futures import ThreadPoolExecutor
    from django.db import close_old_connections
    admin = make_user('parallel@test.com', role='admin')
    def run(_):
        close_old_connections()
        try:
            return open_request(User.objects.get(pk=admin.pk))[0].pk
        finally:
            close_old_connections()
    with ThreadPoolExecutor(max_workers=2) as pool:
        ids = list(pool.map(run, range(2)))
    assert len(set(ids)) == 1
    assert MemberLinkRequest.objects.count() == 1
    assert Notification.objects.count() == 1


@pytest.mark.django_db(transaction=True)
def test_concurrent_candidate_claim_has_one_winner(make_user, make_member):
    from django.db import connection
    if connection.vendor != "postgresql":
        pytest.skip("Row-lock concurrency requires PostgreSQL; covered by the PostgreSQL CI job")
    from concurrent.futures import ThreadPoolExecutor
    from django.db import close_old_connections
    admin = make_user('parallel-admin@test.com', role='admin')
    first, _ = open_request(make_user('parallel-first@test.com'))
    second, _ = open_request(make_user('parallel-second@test.com'))
    candidate = make_member('Cadastro único')
    def run(pk):
        close_old_connections()
        try:
            review_request(User.objects.get(pk=admin.pk), pk, 'approved', candidate.pk)
            return 'approved'
        except LinkConflict:
            return 'conflict'
        finally:
            close_old_connections()
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(run, [first.pk, second.pk]))
    assert sorted(results) == ['approved', 'conflict']
    assert MemberLinkRequest.objects.filter(status='approved').count() == 1


def test_admin_uses_same_service_and_scopes_objects(make_user, make_member):
    from django.contrib.admin.sites import AdminSite
    from django.test import RequestFactory
    from apps.members.admin import MemberLinkRequestAdmin
    admin = make_user('staff@test.com', role='admin', is_staff=True)
    member_user = make_user('applicant@test.com')
    item, _ = open_request(member_user)
    candidate = make_member('Cadastro')
    request = RequestFactory().get('/admin/'); request.user = admin
    handler = MemberLinkRequestAdmin(MemberLinkRequest, AdminSite())
    item.status = 'approved'; item.candidate_member = candidate
    handler.save_model(request, item, None, True)
    candidate.refresh_from_db()
    assert candidate.user == member_user
    assert Notification.objects.filter(recipient=member_user).count() == 1
    assert not handler.has_add_permission(request)
    other = Church.objects.create(name='Outra')
    foreign = User.objects.create_user(username='foreign-admin', email='foreign-admin@test.com', church=other, role='admin', is_staff=True)
    request.user = foreign
    assert handler.get_queryset(request).count() == 0
    assert not handler.has_change_permission(request, item)
