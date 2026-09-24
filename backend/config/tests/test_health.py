"""Testes dos endpoints de saude usados pelo healthcheck do Docker.

O contrato que importa para o deploy:
  - /health/ responde 200 sem tocar no banco (liveness);
  - /health/ready/ responde 200 com o banco de pe e 503 quando ele cai;
  - os dois ficam fora do redirect HTTPS, senao o healthcheck veria 301.
"""
import pytest
from django.conf import settings
from django.test import override_settings
from django.urls import reverse

from config import health


class _BancoQuebrado:
    """Substituto de ``django.db.connections`` que falha em qualquer acesso."""

    def __getitem__(self, alias):
        raise RuntimeError("banco indisponivel (simulado)")


def test_liveness_nao_depende_do_banco(api_client, monkeypatch):
    monkeypatch.setattr(health, "connections", _BancoQuebrado())
    response = api_client.get(reverse("health"))
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "revision": settings.APP_REVISION}


@pytest.mark.django_db
def test_readiness_com_banco_de_pe(api_client):
    response = api_client.get(reverse("health-ready"))
    assert response.status_code == 200
    assert response.json()["status"] == "ready"
    assert response.json()["database"] == "ok"


def test_readiness_retorna_503_com_banco_fora(api_client, monkeypatch):
    monkeypatch.setattr(health, "connections", _BancoQuebrado())
    response = api_client.get(reverse("health-ready"))
    assert response.status_code == 503
    assert response.json()["status"] == "degraded"
    assert response.json()["database"] == "unavailable"


def test_health_so_aceita_get(api_client):
    assert api_client.post(reverse("health")).status_code == 405


def test_health_nao_e_cacheado(api_client):
    response = api_client.get(reverse("health"))
    assert response["Cache-Control"].startswith("max-age=0")


def test_health_fica_fora_do_redirect_https(api_client):
    """Com o redirect ligado, /health/ continua 200 (o resto redireciona)."""
    with override_settings(SECURE_SSL_REDIRECT=True):
        assert api_client.get(reverse("health")).status_code == 200
        assert api_client.get("/api/members/").status_code == 301


def test_revisao_exposta_vem_das_settings(api_client):
    with override_settings(APP_REVISION="abc1234"):
        assert api_client.get(reverse("health")).json()["revision"] == "abc1234"
