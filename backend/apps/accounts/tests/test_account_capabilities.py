"""Contratos de conta composta: membro, lideranca e administracao."""

import pytest

from apps.accounts.models import User

pytestmark = pytest.mark.django_db

PERSONAL_ENDPOINTS = [
    "/api/me/",
    "/api/me/member/",
    "/api/me/statement/",
    "/api/me/schedules/",
    "/api/me/agenda/",
]


def test_membro_comum_tem_experiencia_pessoal_sem_gestao(api_client, make_user, make_member):
    user = make_user("membro.comum@igreja.com")
    make_member("Membro Comum", user=user)
    api_client.force_authenticate(user=user)

    response = api_client.get("/api/me/")

    assert response.status_code == 200
    assert response.data["has_member_profile"] is True
    assert "member" in response.data["capabilities"]
    assert response.data["can_access_management"] is False
    assert api_client.get("/api/leader/cell-members/").status_code == 403


def test_membro_lider_acumula_papel_e_acessa_gestao_autorizada(api_client, make_user, make_member, church):
    from apps.cells.models import Cell

    leader = make_user("lider.composto@igreja.com")
    make_member("Lider Composto", user=leader)
    leader.add_role(User.Role.CELL_LEADER)
    Cell.objects.create(church=church, name="Celula do Lider", leader=leader)
    api_client.force_authenticate(user=leader)

    me = api_client.get("/api/me/")

    assert me.status_code == 200
    assert set(me.data["roles"]) == {User.Role.MEMBER, User.Role.CELL_LEADER}
    assert me.data["has_member_profile"] is True
    assert me.data["can_access_management"] is True
    assert api_client.get("/api/me/member/").status_code == 200
    assert api_client.get("/api/leader/cell-members/").status_code == 200


def test_membro_admin_mantem_apis_pessoais_e_ganha_gestao(api_client, make_user, make_member):
    admin = make_user("admin.composto@igreja.com")
    make_member("Admin Composto", user=admin)
    admin.add_role(User.Role.ADMIN)
    api_client.force_authenticate(user=admin)

    me = api_client.get("/api/me/")

    assert me.status_code == 200
    assert set(me.data["roles"]) == {User.Role.MEMBER, User.Role.ADMIN}
    assert me.data["has_member_profile"] is True
    assert me.data["can_access_management"] is True
    for url in PERSONAL_ENDPOINTS[1:]:
        assert api_client.get(url).status_code == 200
    assert api_client.get("/api/leader/cell-members/").status_code == 200


def test_admin_tecnico_sem_membro_fica_so_na_gestao(api_client, make_user):
    admin = make_user("admin.tecnico@igreja.com", role=User.Role.ADMIN, is_staff=True, is_superuser=True)
    api_client.force_authenticate(user=admin)

    me = api_client.get("/api/me/")

    assert me.status_code == 200
    assert me.data["has_member_profile"] is False
    assert me.data["member_id"] is None
    assert me.data["can_access_management"] is True
    for url in PERSONAL_ENDPOINTS[1:]:
        assert api_client.get(url).status_code == 403
    assert api_client.get("/api/leader/cell-members/").status_code == 200


@pytest.mark.parametrize("papel", [User.Role.ADMIN, User.Role.PASTOR, User.Role.COORDINATOR])
def test_papel_de_escala_recebe_capacidade_manage_schedules(api_client, make_user, papel):
    """Cliente e servidor usam a mesma regra: quem cria escala tem a capacidade."""
    gestor = make_user(f"capacidade.{papel}@igreja.com", role=papel)
    api_client.force_authenticate(user=gestor)

    me = api_client.get("/api/me/")

    assert me.status_code == 200
    assert "manage_schedules" in me.data["capabilities"]


def test_membro_comum_nao_recebe_capacidade_de_escala(api_client, make_user, make_member):
    user = make_user("sem.escala@igreja.com")
    make_member("Sem Escala", user=user)
    api_client.force_authenticate(user=user)

    me = api_client.get("/api/me/")

    assert me.status_code == 200
    assert "manage_schedules" not in me.data["capabilities"]
    assert me.data["can_access_management"] is False

