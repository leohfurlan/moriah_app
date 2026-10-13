from datetime import timedelta
import pytest
from django.utils import timezone
from django.test import override_settings
from rest_framework.test import APIClient
from apps.accounts.models import AuthAttempt, AuthSession, User, WhatsAppIdentity
from .test_security_sessions import login
from .test_whatsapp_auth import sender, challenge, PHONE

pytestmark = pytest.mark.django_db


def test_absolute_expiry_and_rate_window(make_user):
    from rest_framework_simplejwt.tokens import RefreshToken
    user = make_user("absolute@example.invalid")
    client = APIClient()
    tokens = login(client, user).json()
    renewed = client.post("/api/auth/refresh/", {"refresh": tokens["refresh"]}).json()
    assert RefreshToken(renewed["refresh"])["exp"] == RefreshToken(tokens["refresh"])["exp"]
    AuthSession.objects.filter(user=user).update(expires_at=timezone.now() - timedelta(seconds=1))
    assert client.post("/api/auth/refresh/", {"refresh": renewed["refresh"]}).status_code == 401
    for _ in range(4):
        assert login(client, user).status_code == 200
    assert login(client, user).status_code == 429
    AuthAttempt.objects.update(window_started=timezone.now() - timedelta(minutes=16))
    assert login(client, user).status_code == 200


def test_untrusted_headers_do_not_reset_budget(make_user):
    user = make_user("proxy@example.invalid")
    client = APIClient()
    for number in range(5):
        client.credentials(HTTP_X_REAL_IP=f"192.0.2.{number}", HTTP_X_FORWARDED_FOR=f"192.0.2.{number}")
        assert client.post("/api/auth/login/", {"email": user.email, "password": "wrong"}).status_code == 401
    assert login(client, user).status_code == 429
    client.credentials(REMOTE_ADDR="192.0.2.99")
    assert login(client, user).status_code == 200


@override_settings(MFA_REQUIRED=True)
def test_whatsapp_cannot_bypass_mfa(api_client, sender, make_user, church):
    user = make_user("wa-mfa@example.invalid", role=User.Role.TREASURER)
    WhatsAppIdentity.objects.create(user=user, church=church, phone=PHONE)
    identifier, code = challenge(sender)
    response = api_client.post("/api/auth/whatsapp/verify/", {"challenge": str(identifier), "code": code})
    assert response.status_code == 200 and response.json()["mfa_required"]
    assert "access" not in response.json() and not AuthSession.objects.filter(user=user).exists()


@override_settings(MFA_REQUIRED=True)
def test_role_elevation_invalidates_session_and_old_admin_session(make_user):
    user = make_user("elevation@example.invalid")
    client = APIClient()
    tokens = login(client, user).json()
    user.add_role(User.Role.TREASURER)
    client.credentials(HTTP_AUTHORIZATION="Bearer " + tokens["access"])
    assert client.get("/api/me/").status_code == 401
    owner = make_user("admin@igrejamoriah.com", role=User.Role.ADMIN, is_staff=True)
    client.force_login(owner)
    assert client.get("/admin/").status_code == 302


def test_web_cookie_cannot_bypass_csrf_by_omitting_header(make_user):
    user = make_user("csrf-bypass@example.invalid")
    client = APIClient(enforce_csrf_checks=True)
    csrf = client.get("/api/auth/csrf/").json()["csrfToken"]
    client.credentials(HTTP_X_MORIAH_CLIENT="web", HTTP_X_CSRFTOKEN=csrf)
    assert login(client, user).status_code == 200
    client.credentials()
    assert client.post("/api/auth/refresh/", {}).status_code == 403
    assert client.post("/api/auth/logout/", {}).status_code == 403


@override_settings(AUTH_IP_ATTEMPTS=2)
def test_blocked_ip_cannot_grow_account_counter_rows():
    client = APIClient()
    for number in range(2):
        assert client.post("/api/auth/login/", {"email": f"missing{number}@example.invalid", "password": "wrong"}).status_code == 401
    count = AuthAttempt.objects.count()
    for number in range(2, 7):
        assert client.post("/api/auth/login/", {"email": f"missing{number}@example.invalid", "password": "wrong"}).status_code == 429
    assert AuthAttempt.objects.count() == count
