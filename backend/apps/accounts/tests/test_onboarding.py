from concurrent.futures import ThreadPoolExecutor
from datetime import date
from unittest.mock import patch

import pytest
from django.db import close_old_connections, connection
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import Church, ChurchSetup, OnboardingProfile, User, WhatsAppIdentity
from apps.accounts.onboarding import complete_personal
from apps.cells.models import Cell, CellAttendance, CellMeeting
from apps.events.models import Event, ServiceTime
from apps.members.linking import LinkConflict, open_request, review_request
from apps.members.models import Member, MemberLinkRequest, MemberUpdateRequest
from apps.ministries.models import Ministry

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def enable_guard(settings):
    settings.ONBOARDING_REQUIRED = True


def client_for(user):
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}")
    return client


@pytest.fixture
def person(make_user, church):
    user = make_user("person@example.invalid", first_name="Pessoa", last_name="Exemplo")
    WhatsAppIdentity.objects.create(user=user, church=church, phone="+5511999991001")
    return user


def ready(user, relationship="discovering"):
    return OnboardingProfile.objects.create(user=user, birth_date=date(1990, 5, 1), relationship=relationship, step="profile")


@pytest.mark.parametrize("base", ["/api", "/backend", "/local-api"])
def test_guard_and_completion_all_aliases(person, base):
    client = client_for(person)
    assert client.get(base + "/me/").status_code == 200
    assert client.get(base + "/me/events/").json()["code"] == "onboarding_required"
    assert client.get(base + "/me/onboarding/").json()["profile"]["name"] == "Pessoa Exemplo"
    assert client.post(base + "/me/onboarding/complete/", {}, format="json").status_code == 400
    saved = client.patch(base + "/me/onboarding/", {"birth_date": "1990-05-01", "relationship": "discovering", "step": "profile"}, format="json")
    assert saved.status_code == 200
    assert client_for(person).get(base + "/me/onboarding/").json()["profile"]["birth_date"] == "1990-05-01"
    assert client.post(base + "/me/onboarding/complete/", {}, format="json").status_code == 200
    assert client.get(base + "/me/events/").status_code == 200
    assert client.get(base + "/me/").json()["onboarding_completed"] is True
    assert not MemberLinkRequest.objects.exists()


@pytest.mark.parametrize("body", [
    {"birth_date": "not-a-date"}, {"birth_date": "2999-01-01"}, {"relationship": "admin"},
    {"name": " "}, {"church_id": 99}, {"step": "done"}, {"completed_at": "2020-01-01"},
])
def test_invalid_personal_fields(person, body):
    result = client_for(person).patch("/backend/me/onboarding/", body, format="json")
    assert result.status_code == 400
    assert not OnboardingProfile.objects.filter(user=person, completed_at__isnull=False).exists()


def test_missing_identity_and_no_church(person):
    ready(person)
    WhatsAppIdentity.objects.filter(user=person).delete()
    client = client_for(person)
    assert "whatsapp" in client.post("/backend/me/onboarding/complete/", {}, format="json").json()
    person.church = None
    person.save()
    assert client.get("/backend/me/onboarding/").status_code == 403


def test_admin_without_member_reuses_identity(person):
    person.role = "admin"
    person.save()
    ready(person)
    result = client_for(person).post("/backend/me/onboarding/complete/", {}, format="json")
    assert result.status_code == 200
    assert result.json()["journey"] == "admin"
    assert not Member.objects.filter(user=person).exists()
    assert WhatsAppIdentity.objects.filter(user=person).count() == 1


def test_visitor_completion_and_human_confirmation(person, make_user, church):
    visitor = Member.objects.create(church=church, user=person, full_name="Visitante", status="visitor")
    ready(person, "member")
    client = client_for(person)
    first = client.post("/backend/me/onboarding/complete/", {}, format="json")
    assert first.status_code == 200 and first.json()["member_link"]["state"] == "pending"
    assert client.post("/backend/me/onboarding/complete/", {}, format="json").status_code == 200
    assert MemberLinkRequest.objects.filter(user=person).count() == 1
    visitor.refresh_from_db()
    assert visitor.status == "visitor"
    assert MemberUpdateRequest.objects.filter(member=visitor).count() == 1
    reviewer = make_user("admin@example.invalid", role="admin")
    ready(reviewer)
    complete_personal_for_test(reviewer)
    review_client = client_for(reviewer)
    request = MemberLinkRequest.objects.get(user=person)
    candidates = review_client.get(f"/backend/member-link-requests/{request.pk}/candidates/").json()
    assert visitor.pk in [item["id"] for item in candidates]
    result = review_client.post(f"/backend/member-link-requests/{request.pk}/review/", {"decision": "approved", "candidate_member": visitor.pk}, format="json")
    assert result.status_code == 200
    visitor.refresh_from_db()
    assert visitor.status == "active"
    assert client.get("/backend/me/onboarding/").json()["member_link"]["state"] == "confirmed"
    person.refresh_from_db()
    assert person.role == "member"


def complete_personal_for_test(user):
    OnboardingProfile.objects.filter(user=user).update(completed_at=timezone.now(), step="done")


def test_pending_and_confirmed_are_not_duplicated(person, church):
    ready(person, "member")
    pending, _ = open_request(person)
    assert complete_personal(person)["member_link"]["request_id"] == pending.pk
    assert MemberLinkRequest.objects.filter(user=person).count() == 1


def test_confirmed_member_no_request_and_birth_requires_review(person, church):
    member = Member.objects.create(church=church, user=person, full_name="Oficial", birth_date=date(1989, 1, 1))
    ready(person, "member")
    complete_personal(person)
    assert not MemberLinkRequest.objects.exists()
    member.refresh_from_db()
    assert member.birth_date == date(1989, 1, 1)
    assert MemberUpdateRequest.objects.get(member=member).requested_changes == {"birth_date": "1990-05-01"}


def test_partial_failure_rolls_back_completion(person):
    ready(person, "member")
    with patch("apps.members.linking.notify_reviewers", side_effect=RuntimeError("local failure")):
        with pytest.raises(RuntimeError):
            complete_personal(person)
    assert not MemberLinkRequest.objects.filter(user=person).exists()
    assert OnboardingProfile.objects.get(user=person).completed_at is None
    assert complete_personal(person)["status"] == "completed"


def test_merge_preserves_activity_and_conflicts_roll_back(person, make_user, church):
    visitor = Member.objects.create(church=church, user=person, full_name="Visitante", status="visitor")
    official = Member.objects.create(church=church, full_name="Oficial", birth_date=date(1980, 1, 1))
    cell = Cell.objects.create(church=church, name="Célula")
    meeting = CellMeeting.objects.create(church=church, cell=cell, date=date.today())
    attendance = CellAttendance.objects.create(church=church, meeting=meeting, member=visitor)
    ministry = Ministry.objects.create(church=church, name="Ministério")
    ministry.members.add(visitor)
    reviewer = make_user("reviewer@example.invalid", role="admin")
    item, _ = open_request(person)
    duplicate = CellAttendance.objects.create(church=church, meeting=meeting, member=official)
    with pytest.raises(LinkConflict):
        review_request(reviewer, item.pk, "approved", official.pk)
    visitor.refresh_from_db()
    assert visitor.user_id == person.pk
    duplicate.delete()
    review_request(reviewer, item.pk, "approved", official.pk)
    attendance.refresh_from_db(); official.refresh_from_db(); visitor.refresh_from_db()
    assert attendance.member_id == official.pk and visitor.user_id is None
    assert official.birth_date == date(1980, 1, 1)
    assert ministry.members.filter(pk=official.pk).exists()


def test_service_times_permissions_validation_and_scope(person, make_user, church):
    admin = make_user("admin@example.invalid", role="admin")
    ready(admin); complete_personal_for_test(admin)
    ready(person); complete_personal_for_test(person)
    ac, pc = client_for(admin), client_for(person)
    path = "/backend/church/service-times/"
    body = {"weekday": 6, "time": "19:00", "location": "Templo"}
    assert pc.post(path, body, format="json").status_code == 403
    response = ac.post(path, body, format="json")
    assert response.status_code == 201
    pk = response.json()["id"]
    assert ac.post(path, body, format="json").status_code == 400
    assert len(pc.get(path).json()) == 1
    for bad in ({"weekday": 7}, {"weekday": -1}, {"time": "25:00"}, {"location": ""}, {"church_id": 99}):
        assert ac.patch(f"{path}{pk}/", bad, format="json").status_code == 400
    other = Church.objects.create(name="Outra")
    external = ServiceTime.objects.create(church=other, weekday=0, time="18:00", location="Outro")
    assert ac.patch(f"{path}{external.pk}/", {"location": "Ataque"}, format="json").status_code == 404
    assert pc.get(path + "?include_inactive=true").status_code == 403
    assert ac.patch(f"{path}{pk}/", {"active": False}, format="json").status_code == 200
    assert pc.get(path).json() == []
    assert ac.delete(f"{path}{pk}/").status_code == 204


def test_setup_shared_percentage_and_card_regression(person, make_user, church):
    person.role = "admin"; person.save()
    second = make_user("second@example.invalid", role="admin")
    for user in (person, second):
        ready(user); complete_personal_for_test(user)
    ac, bc = client_for(person), client_for(second)
    path = "/backend/church/setup/"
    assert ac.get(path).json()["percentage"] == 0
    assert ac.post(path + "dismiss/", {}, format="json").status_code == 409
    assert ac.post(path + "confirm/", {"item": "first_cell"}, format="json").status_code == 400
    result = ac.post(path + "confirm/", {"item": "church_review"}, format="json")
    assert result.json()["percentage"] == 17
    ac.post(path + "confirm/", {"item": "church_review"}, format="json")
    assert ChurchSetup.objects.get(church=church).church_reviewed_by_id == person.pk
    bc.post(path + "confirm/", {"item": "team_review"}, format="json")
    assert ac.get(path).json()["percentage"] == 33
    ServiceTime.objects.create(church=church, weekday=6, time="19:00", location="Templo")
    Event.objects.create(church=church, name="Evento", start_at=timezone.now())
    cell = Cell.objects.create(church=church, name="Célula")
    Ministry.objects.create(church=church, name="Ministério")
    assert ac.get(path).json()["percentage"] == 100
    assert ac.post(path + "dismiss/", {}, format="json").json()["card_visible"] is False
    assert bc.get(path).json()["card_visible"] is True
    # No read while incomplete: dismissal must still be invalidated.
    cell.delete()
    Cell.objects.create(church=church, name="Nova célula")
    assert ac.get(path).json()["card_visible"] is True
    assert ac.get(path).json()["percentage"] == 100


def test_setup_cannot_leak_other_church_or_be_used_by_member(person, church):
    ready(person); complete_personal_for_test(person)
    assert client_for(person).get("/backend/church/setup/").status_code == 403
    other = Church.objects.create(name="Outra")
    Event.objects.create(church=other, name="Segredo", start_at=timezone.now())
    Cell.objects.create(church=other, name="Segredo")
    person.role = "admin"; person.save()
    assert client_for(person).get("/backend/church/setup/").json()["completed_count"] == 0


def test_admin_session_guard_and_scoped_configuration(person, church):
    person.is_staff = True; person.is_superuser = True; person.role = "admin"; person.save()
    client = APIClient(); client.force_login(person)
    assert client.get("/admin/").url == "/onboarding"
    assert client.get("/admin/logout/").status_code in (200, 405)
    ready(person); complete_personal_for_test(person)
    assert client.get("/admin/").status_code == 200
    other = Church.objects.create(name="Outra igreja privada")
    assert "Outra igreja privada" not in client.get("/admin/accounts/church/").content.decode()
    assert client.get(f"/admin/accounts/church/{other.pk}/change/").status_code in (302, 404)


def test_historical_approval_without_current_member_is_not_confirmed(person, church):
    MemberLinkRequest.objects.create(church=church, user=person, requested_email=person.email, status="approved")
    assert client_for(person).get("/backend/me/onboarding/").json()["member_link"]["state"] == "none"


def test_private_signed_media_does_not_bypass_profile_guard(person, church, settings):
    from django.core.files.uploadedfile import SimpleUploadedFile
    from django.test import RequestFactory
    from config.private_media import private_file_url
    from apps.finance.models import Contribution, ContributionAttachment
    settings.PRIVATE_LOCAL_MEDIA = True
    settings.USE_S3_STORAGE = False
    member = Member.objects.create(church=church, user=person, full_name="Pessoa")
    contribution = Contribution.objects.create(church=church, member=member, amount="10", contribution_date=date.today(), category="offering")
    attachment = ContributionAttachment.objects.create(contribution=contribution, uploaded_by=person, original_name="qa.pdf", file=SimpleUploadedFile("qa.pdf", b"%PDF-1.4 QA"))
    request = RequestFactory().get("/"); request.user = person
    url = private_file_url(request, "contribution", attachment)
    anonymous = APIClient()
    assert anonymous.get(url).status_code == 404
    ready(person); complete_personal_for_test(person)
    assert anonymous.get(url).status_code == 200


@pytest.mark.django_db(transaction=True)
def test_concurrent_completion_and_review_do_not_duplicate(person, make_user, church):
    if connection.vendor != "postgresql":
        pytest.skip("Row locks require PostgreSQL")
    ready(person, "member")
    def finish(_):
        close_old_connections()
        try:
            return complete_personal(User.objects.get(pk=person.pk))["status"]
        finally:
            close_old_connections()
    with ThreadPoolExecutor(max_workers=2) as pool:
        assert list(pool.map(finish, [0, 1])) == ["completed", "completed"]
    assert MemberLinkRequest.objects.filter(user=person, status="pending").count() == 1


@pytest.mark.django_db(transaction=True)
def test_completion_racing_human_review_preserves_confirmed_link(person, make_user, church):
    if connection.vendor != "postgresql":
        pytest.skip("Row locks require PostgreSQL")
    ready(person, "member")
    item, _ = open_request(person)
    candidate = Member.objects.create(church=church, full_name="Cadastro oficial")
    reviewer = make_user("race-admin@example.invalid", role="admin")
    def race(operation):
        close_old_connections()
        try:
            if operation == "complete":
                complete_personal(User.objects.get(pk=person.pk))
            else:
                review_request(User.objects.get(pk=reviewer.pk), item.pk, "approved", candidate.pk)
        finally:
            close_old_connections()
    with ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(race, ["complete", "review"]))
    candidate.refresh_from_db(); item.refresh_from_db()
    assert candidate.user_id == person.pk and item.status == "approved"
    assert MemberLinkRequest.objects.filter(user=person).count() == 1
    assert OnboardingProfile.objects.get(user=person).completed_at is not None
