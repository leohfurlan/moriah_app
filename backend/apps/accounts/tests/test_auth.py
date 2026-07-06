"""Testes de autenticacao (login via JWT)."""
import pytest

from conftest import DEFAULT_PASSWORD

pytestmark = pytest.mark.django_db

LOGIN_URL = "/api/auth/login/"


def test_login_com_credenciais_corretas_retorna_tokens(api_client, make_user):
    make_user(email="pastor@igreja.com")

    response = api_client.post(
        LOGIN_URL,
        {"email": "pastor@igreja.com", "password": DEFAULT_PASSWORD},
        format="json",
    )

    assert response.status_code == 200
    assert "access" in response.data
    assert "refresh" in response.data


def test_login_com_senha_incorreta_retorna_401(api_client, make_user):
    make_user(email="pastor@igreja.com")

    response = api_client.post(
        LOGIN_URL,
        {"email": "pastor@igreja.com", "password": "senha-errada"},
        format="json",
    )

    assert response.status_code == 401
    assert "access" not in response.data


def test_login_com_usuario_inexistente_retorna_401(api_client):
    response = api_client.post(
        LOGIN_URL,
        {"email": "ninguem@igreja.com", "password": DEFAULT_PASSWORD},
        format="json",
    )

    assert response.status_code == 401
