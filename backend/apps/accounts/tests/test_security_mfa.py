import pytest
import pyotp
from urllib.parse import urlsplit, parse_qs
from django.test import override_settings
from rest_framework.test import APIClient
from conftest import DEFAULT_PASSWORD
from apps.accounts.models import User, MFAFactor
from .test_security_sessions import login

pytestmark = pytest.mark.django_db


@override_settings(MFA_REQUIRED=True)
def test_privileged_login_requires_totp_then_single_use_recovery(make_user):
    user = make_user(email="mfa@example.invalid", role=User.Role.TREASURER)
    client = APIClient()
    challenge = login(client, user).json()
    assert challenge["mfa_required"] and "access" not in challenge
    setup = client.post("/api/auth/mfa/enroll/", {"challenge": challenge["challenge"]}, format="json")
    assert setup.status_code == 200
    secret = parse_qs(urlsplit(setup.json()["uri"]).query)["secret"][0]
    assert secret not in MFAFactor.objects.get(user=user).encrypted_secret
    code = pyotp.TOTP(secret).now()
    body = {"challenge": challenge["challenge"], "code": code}
    confirmed = client.post("/api/auth/mfa/verify/", body, format="json")
    assert confirmed.status_code == 200 and confirmed.json()["access"]
    recovery = confirmed.json()["recovery_codes"][0]
    assert client.post("/api/auth/mfa/verify/", body, format="json").status_code == 401
    second = login(client, user).json()
    assert not second["enrollment_required"]
    assert client.post("/api/auth/mfa/enroll/", {"challenge": second["challenge"]}).status_code == 400
    assert client.post("/api/auth/mfa/verify/", {"challenge": second["challenge"], "code": code}).status_code == 401
    body = {"challenge": second["challenge"], "code": recovery}
    assert client.post("/api/auth/mfa/verify/", body).status_code == 200
    third = login(client, user).json()
    assert client.post("/api/auth/mfa/verify/", {"challenge": third["challenge"], "code": recovery}).status_code == 401


@override_settings(MFA_REQUIRED=True)
def test_mfa_attempts_and_password_change_invalidate_challenge(make_user):
    user = make_user(email="mfa2@example.invalid", role=User.Role.ADMIN)
    client = APIClient()
    challenge = login(client, user).json()["challenge"]
    for _ in range(6):
        assert client.post("/api/auth/mfa/verify/", {"challenge": challenge, "code": "000000"}).status_code == 401
    user.set_password("new-strong-password")
    user.save()
    assert client.post("/api/auth/mfa/enroll/", {"challenge": challenge}).status_code == 401


@override_settings(MFA_REQUIRED=True)
def test_admin_login_enrollment_recovery_and_logout(make_user):
    from apps.accounts.models import AuthSession
    owner = make_user(email="admin@igrejamoriah.com", role=User.Role.ADMIN, is_staff=True, is_superuser=True)
    client = APIClient()
    first = login(client, owner).json()
    setup = client.post("/api/auth/mfa/enroll/", {"challenge": first["challenge"]}).json()
    secret = parse_qs(urlsplit(setup["uri"]).query)["secret"][0]
    verified = client.post("/api/auth/mfa/verify/", {"challenge": first["challenge"], "code": pyotp.TOTP(secret).now()}).json()
    assert client.post("/admin/login/", {"username": owner.email, "password": DEFAULT_PASSWORD}).status_code == 200
    assert client.post("/admin/login/", {"username": owner.email, "password": DEFAULT_PASSWORD,
                                              "mfa_code": verified["recovery_codes"][0]}).status_code == 302
    assert client.get("/admin/").status_code == 200
    sid = client.session["moriah_auth_sid"]
    assert client.post("/admin/logout/").status_code == 200
    assert AuthSession.objects.get(pk=sid).revoked_at is not None
