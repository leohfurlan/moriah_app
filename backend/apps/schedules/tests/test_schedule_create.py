import pytest

from apps.events.models import Event
from apps.schedules.models import Schedule

pytestmark = pytest.mark.django_db


def test_admin_cria_evento_e_escala_no_mvp(api_client, make_user):
    admin = make_user("admin@igreja.com", role="admin")
    api_client.force_authenticate(user=admin)

    response = api_client.post(
        "/api/schedules/",
        {
            "event_name": "Culto especial",
            "event_type": "especial",
            "start_at": "2026-09-20T19:00:00-03:00",
            "location": "Auditório",
            "schedule_name": "Escala culto especial",
            "status": "published",
        },
        format="json",
    )

    assert response.status_code == 201
    assert Event.objects.filter(name="Culto especial", church=admin.church).exists()
    assert Schedule.objects.filter(name="Escala culto especial", church=admin.church, status=Schedule.Status.PUBLISHED).exists()


def test_membro_nao_cria_escala_e_recebe_mensagem_em_portugues(api_client, make_user):
    """Fase 1 do plano: o 403 de escala precisa explicar o que falta, em PT-BR."""
    membro = make_user("membro.sem.escala@igreja.com", role="member")
    api_client.force_authenticate(user=membro)

    response = api_client.post(
        "/api/schedules/",
        {
            "event_name": "Escala proibida",
            "event_type": "culto",
            "start_at": "2026-09-27T19:00:00-03:00",
            "location": "Templo",
            "schedule_name": "Escala proibida",
            "status": "published",
        },
        format="json",
    )

    assert response.status_code == 403
    detalhe = str(response.data.get("detail", ""))
    assert "coordenadores de escala" in detalhe
    assert "secretaria" in detalhe
    assert not Schedule.objects.filter(name="Escala proibida").exists()
    assert not Event.objects.filter(name="Escala proibida").exists()


@pytest.mark.parametrize("papel", ["admin", "pastor", "coordinator"])
def test_lideranca_e_coordenacao_criam_escala(api_client, make_user, papel):
    """A capacidade publicada em /api/me/ tem que casar com esta permissao."""
    gestor = make_user(f"gestor.escala.{papel}@igreja.com", role=papel)
    api_client.force_authenticate(user=gestor)

    response = api_client.post(
        "/api/schedules/",
        {
            "event_name": f"Culto {papel}",
            "event_type": "culto",
            "start_at": "2026-09-27T19:00:00-03:00",
            "location": "Templo",
            "schedule_name": f"Escala {papel}",
            "status": "published",
        },
        format="json",
    )

    assert response.status_code == 201, response.data
    assert "manage_schedules" in api_client.get("/api/me/").data["capabilities"]

