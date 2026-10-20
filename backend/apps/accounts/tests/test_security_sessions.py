import pytest
from rest_framework.test import APIClient
from conftest import DEFAULT_PASSWORD

pytestmark = pytest.mark.django_db


def login(client, user, prefix="/api"):
    return client.post(prefix + "/auth/login/", {"email": user.email, "password": DEFAULT_PASSWORD}, format="json")


@pytest.mark.parametrize("prefix", ["/api", "/backend", "/local-api"])
def test_rotation_logout_and_password_revoke(make_user, prefix):
    user = make_user(email="session@example.invalid")
    client = APIClient()
    tokens = login(client, user, prefix).json()
    renewed = client.post(prefix + "/auth/refresh/", {"refresh": tokens["refresh"]}, format="json")
    assert renewed.status_code == 200
    assert renewed.json()["refresh"] != tokens["refresh"]
    assert client.post(prefix + "/auth/refresh/", {"refresh": tokens["refresh"]}, format="json").status_code == 401
    client.credentials(HTTP_AUTHORIZATION="Bearer " + renewed.json()["access"])
    assert client.get(prefix + "/me/").status_code == 200
    assert client.post(prefix + "/auth/logout/", {}, format="json").status_code == 204
    assert client.get(prefix + "/me/").status_code == 401
    assert client.post(prefix + "/auth/refresh/", {"refresh": renewed.json()["refresh"]}, format="json").status_code == 401
    client.credentials()
    tokens = login(client, user, prefix).json()
    user.set_password("other-strong-password-2026")
    user.save()
    client.credentials(HTTP_AUTHORIZATION="Bearer " + tokens["access"])
    assert client.get(prefix + "/me/").status_code == 401
    assert client.post(prefix + "/auth/refresh/", {"refresh": tokens["refresh"]}, format="json").status_code == 401


def test_inactive_church_and_legacy_tokens(make_user, church):
    from rest_framework_simplejwt.tokens import RefreshToken
    user = make_user(email="inactive@example.invalid")
    client = APIClient()
    legacy = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION="Bearer " + str(legacy.access_token))
    assert client.get("/api/me/").status_code == 401
    client.credentials()
    tokens = login(client, user).json()
    church.active = False
    church.save()
    assert login(client, user).status_code == 401
    assert client.post("/api/auth/refresh/", {"refresh": tokens["refresh"]}, format="json").status_code == 401
    client.credentials(HTTP_AUTHORIZATION="Bearer " + tokens["access"])
    assert client.get("/api/me/").status_code == 401


def test_shared_login_budget(make_user):
    user = make_user(email="rate@example.invalid")
    client = APIClient()
    for _ in range(5):
        assert client.post("/api/auth/login/", {"email": user.email, "password": "wrong"}).status_code == 401
    assert login(client, user, "/backend").status_code == 429


def test_web_cookie_requires_csrf_and_hides_refresh(make_user):
    user = make_user(email="web@example.invalid")
    client = APIClient(enforce_csrf_checks=True)
    client.credentials(HTTP_X_MORIAH_CLIENT="web")
    assert login(client, user).status_code == 403
    csrf = client.get("/api/auth/csrf/").json()["csrfToken"]
    client.credentials(HTTP_X_MORIAH_CLIENT="web", HTTP_X_CSRFTOKEN=csrf)
    response = login(client, user)
    assert response.status_code == 200
    assert "refresh" not in response.json()
    cookie = response.cookies["moriah_refresh"]
    assert cookie["httponly"] and cookie["secure"] and cookie["samesite"] == "Strict"
    assert client.post("/api/auth/refresh/", {}, format="json").status_code == 200
    client.credentials(HTTP_X_MORIAH_CLIENT="web")
    assert client.post("/api/auth/refresh/", {}, format="json").status_code == 403
