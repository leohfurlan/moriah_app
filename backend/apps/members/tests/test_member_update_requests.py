import pytest

pytestmark = pytest.mark.django_db


def test_membro_cria_solicitacao_cadastral(api_client, make_user, make_member):
    user = make_user("membro@igreja.com")
    make_member("Maria", user=user)
    api_client.force_authenticate(user=user)
    response = api_client.post("/api/me/member-requests/", {"requested_changes": {"phone": "(15) 99999-0000", "address": "Rua Nova"}}, format="json")
    assert response.status_code == 201
    assert response.data["status"] == "pending"
    assert api_client.get("/api/me/member-requests/").data[0]["requested_changes"]["phone"] == "(15) 99999-0000"


def test_membro_nao_pode_solicitar_campo_restrito(api_client, make_user, make_member):
    user = make_user("membro@igreja.com")
    make_member("Maria", user=user)
    api_client.force_authenticate(user=user)
    response = api_client.post("/api/me/member-requests/", {"requested_changes": {"status": "inactive"}}, format="json")
    assert response.status_code == 400