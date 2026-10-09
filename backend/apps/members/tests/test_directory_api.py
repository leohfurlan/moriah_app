import pytest

from apps.accounts.models import User


pytestmark = pytest.mark.django_db


def test_gestor_consulta_membros_e_visitantes_isolados_por_status(api_client, make_user, make_member):
    admin = make_user("admin.directory@igreja.com", role=User.Role.ADMIN)
    make_member("Ana Membro", status="active")
    make_member("Bruno Visitante", status="visitor")
    api_client.force_authenticate(user=admin)

    members = api_client.get("/api/members/?status=active")
    visitors = api_client.get("/api/members/?status=visitor")

    assert members.status_code == 200
    assert [item["full_name"] for item in members.data] == ["Ana Membro"]
    assert visitors.status_code == 200
    assert [item["full_name"] for item in visitors.data] == ["Bruno Visitante"]


def test_membro_comum_nao_consulta_diretorio_administrativo(api_client, make_user, make_member):
    member_user = make_user("member.directory@igreja.com")
    make_member("Membro comum", user=member_user)
    api_client.force_authenticate(user=member_user)

    assert api_client.get("/api/members/?status=active").status_code == 403
