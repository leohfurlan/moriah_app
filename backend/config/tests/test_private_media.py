from unittest.mock import patch
from urllib.parse import urlsplit

import pytest
from django.core import signing
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework.test import APIRequestFactory

from apps.accounts.models import Church, User
from apps.events.models import Event, EventAnnouncement
from apps.finance.models import Contribution, ContributionAttachment
from config.private_media import SALT, private_file_url

# Streaming responses close request connections; do not wrap the request in
# pytest's outer atomic transaction (PostgreSQL correctly closes that handle).
pytestmark = pytest.mark.django_db(transaction=True)


@pytest.fixture(autouse=True)
def local_private_storage():
    with override_settings(PRIVATE_LOCAL_MEDIA=True, USE_S3_STORAGE=False):
        yield


@pytest.fixture
def receipt(make_user, make_member, church):
    user = make_user("owner@igreja.com")
    member = make_member("Owner", user=user)
    contribution = Contribution.objects.create(
        church=church, member=member, amount="100.00", contribution_date="2026-10-08",
        category=Contribution.Category.OFFERING,
    )
    obj = ContributionAttachment.objects.create(
        contribution=contribution, uploaded_by=user, original_name="receipt.pdf",
        file=SimpleUploadedFile("receipt.pdf", b"%PDF-1.4 receipt", content_type="application/pdf"),
    )
    return user, obj


def link(user, obj, kind="contribution"):
    request = APIRequestFactory().get("/", secure=True)
    request.user = user
    url = urlsplit(private_file_url(request, kind, obj))
    return url.path + "?" + url.query


def test_owner_and_treasurer_can_download_without_jwt_in_url(api_client, receipt, make_user):
    owner, obj = receipt
    treasurer = make_user("treasurer@igreja.com", role=User.Role.TREASURER)
    for user in (owner, treasurer):
        response = api_client.get(link(user, obj))
        assert response.status_code == 200
        assert b"%PDF" in b"".join(response.streaming_content)
        assert response["Cache-Control"] == "private, no-store"
        assert "attachment" in response["Content-Disposition"]
        response.close()


def test_other_member_and_other_church_cannot_access(api_client, receipt, make_user, make_member):
    _, obj = receipt
    other = make_user("other@igreja.com")
    make_member("Other", user=other)
    assert api_client.get(link(other, obj)).status_code == 404
    other_church = Church.objects.create(name="Other Church")
    foreign = User.objects.create_user(
        username="foreign", email="foreign@igreja.com", church=other_church,
        role=User.Role.ADMIN, password="test-only",
    )
    assert api_client.get(link(foreign, obj)).status_code == 404


def test_unsigned_tampered_expired_and_other_file_links_are_rejected(api_client, receipt):
    user, obj = receipt
    url = link(user, obj)
    assert api_client.get(f"/api/files/contribution/{obj.pk}/").status_code == 404
    assert api_client.get(url + "tampered").status_code == 404
    assert api_client.get(url.replace(f"/{obj.pk}/", f"/{obj.pk + 1}/")).status_code == 404
    with patch("django.core.signing.time.time", return_value=1):
        old = link(user, obj)
    assert api_client.get(old).status_code == 404


def test_user_revocation_and_role_revocation_apply_to_existing_links(api_client, receipt, make_user):
    owner, obj = receipt
    url = link(owner, obj)
    owner.is_active = False
    owner.save(update_fields=["is_active"])
    assert api_client.get(url).status_code == 404
    treasurer = make_user("revoked@igreja.com", role=User.Role.TREASURER)
    url = link(treasurer, obj)
    treasurer.role = User.Role.MEMBER
    treasurer.save(update_fields=["role"])
    assert api_client.get(url).status_code == 404


def test_announcement_visibility_is_checked_again(api_client, make_user, make_member, church):
    from django.utils import timezone
    user = make_user("member@igreja.com")
    make_member("Member", user=user)
    event = Event.objects.create(church=church, name="Service", start_at=timezone.now())
    obj = EventAnnouncement.objects.create(
        church=church, event=event,
        image=SimpleUploadedFile("folder.png", b"\x89PNG\r\n\x1a\nimage"),
    )
    url = link(user, obj, "announcement")
    response = api_client.get(url)
    assert response.status_code == 200
    response.close()
    obj.active = False
    obj.save(update_fields=["active"])
    assert api_client.get(url).status_code == 404


def test_local_storage_check_requires_actual_mount(tmp_path):
    from config.checks import check_arquivos_de_producao
    with override_settings(
        DEBUG=False, USE_S3_STORAGE=False, PRIVATE_LOCAL_MEDIA=True,
        LOCAL_MEDIA_PERSISTENT=True, MEDIA_ROOT=tmp_path,
        CORS_ALLOWED_ORIGINS=[], CSRF_TRUSTED_ORIGINS=[],
    ):
        assert "config.W005" in {p.id for p in check_arquivos_de_producao(None)}
        with patch("config.checks.Path.is_mount", return_value=True):
            assert check_arquivos_de_producao(None) == []


def test_admin_widget_uses_a_private_file_link(receipt):
    from config.private_media import PrivateMediaWidget
    user, obj = receipt
    request = APIRequestFactory().get("/admin/", secure=True)
    request.user = user
    context = PrivateMediaWidget(request, "contribution").get_context("file", obj.file, {})
    assert context["widget"]["is_initial"]
    assert "/api/files/contribution/" in context["widget"]["value"].url
    assert "/media/" not in context["widget"]["value"].url
