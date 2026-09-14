"""Usuarios de operacao (sem cadastro de membro) nas telas do app.

Admin, tesouraria e secretaria existem sem ``Member`` — eles trabalham no
painel web. Antes desta protecao, abrir perfil/extrato/escala com um desses
usuarios estourava 500 (``RelatedObjectDoesNotExist`` no OneToOne reverso).
"""
import pytest

from apps.accounts.models import User

pytestmark = pytest.mark.django_db

ENDPOINTS_DO_APP = [
    "/api/me/member/",
    "/api/me/statement/",
    "/api/me/schedules/",
]


@pytest.mark.parametrize("url", ENDPOINTS_DO_APP)
@pytest.mark.parametrize("role", [User.Role.ADMIN, User.Role.TREASURER, User.Role.SECRETARY])
def test_usuario_sem_cadastro_de_membro_recebe_403_e_nao_500(api_client, make_user, url, role):
    operador = make_user(f"operador.{role}@igreja.com", role=role)
    api_client.force_authenticate(user=operador)

    response = api_client.get(url)

    assert response.status_code == 403
    # A mensagem precisa explicar o que fazer, nao so negar o acesso.
    assert "cadastro de membro" in str(response.data["detail"])


def test_usuario_sem_membro_nao_cria_contribuicao(api_client, make_user):
    tesoureiro = make_user("tesoureiro.sem.membro@igreja.com", role=User.Role.TREASURER)
    api_client.force_authenticate(user=tesoureiro)

    response = api_client.post(
        "/api/contributions/",
        {"amount": "50.00", "category": "tithe", "contribution_date": "2026-08-23"},
        format="json",
    )

    assert response.status_code == 403


def test_membro_com_cadastro_continua_acessando(api_client, make_user, make_member):
    user = make_user("membro.normal@igreja.com")
    make_member("Membro Normal", user=user)
    api_client.force_authenticate(user=user)

    for url in ENDPOINTS_DO_APP:
        assert api_client.get(url).status_code == 200


def test_acao_de_escala_exige_cadastro_de_membro(api_client, make_user):
    admin = make_user("admin.sem.membro@igreja.com", role=User.Role.ADMIN)
    api_client.force_authenticate(user=admin)

    response = api_client.post("/api/me/schedules/1/action/", {"action": "confirm"}, format="json")

    assert response.status_code == 403
