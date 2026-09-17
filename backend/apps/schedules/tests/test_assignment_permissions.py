"""Regra do PRD: o membro so confirma ou recusa a propria escala."""
import datetime

import pytest
from rest_framework import status

from apps.events.models import Event
from apps.ministries.models import Ministry, MinistryRole
from apps.schedules.models import Schedule, ScheduleAssignment

pytestmark = pytest.mark.django_db


@pytest.fixture
def escalados(make_user, make_member, church):
    """Dois membros escalados no mesmo culto, em funcoes distintas."""
    user_a = make_user("escalado.a@igreja.com")
    user_b = make_user("escalado.b@igreja.com")
    membro_a = make_member("Escalado A", user=user_a)
    membro_b = make_member("Escalado B", user=user_b)

    evento = Event.objects.create(
        church=church,
        name="Culto de Domingo",
        start_at=datetime.datetime(2026, 8, 23, 19, 0, tzinfo=datetime.timezone.utc),
    )
    escala = Schedule.objects.create(church=church, event=evento, name="Louvor")
    ministerio = Ministry.objects.create(church=church, name="Louvor")
    vocal = MinistryRole.objects.create(church=church, ministry=ministerio, name="Vocal")
    baixo = MinistryRole.objects.create(church=church, ministry=ministerio, name="Baixo")

    return {
        "user_a": user_a,
        "user_b": user_b,
        "assignment_a": ScheduleAssignment.objects.create(
            church=church, schedule=escala, member=membro_a, ministry_role=vocal
        ),
        "assignment_b": ScheduleAssignment.objects.create(
            church=church, schedule=escala, member=membro_b, ministry_role=baixo
        ),
    }


def test_membro_lista_apenas_as_proprias_escalas(api_client, escalados):
    api_client.force_authenticate(user=escalados["user_a"])

    response = api_client.get("/api/me/schedules/")

    assert response.status_code == 200
    assert {item["id"] for item in response.data} == {escalados["assignment_a"].id}


def test_membro_confirma_a_propria_escala(api_client, escalados):
    api_client.force_authenticate(user=escalados["user_a"])

    response = api_client.post(
        f"/api/me/schedules/{escalados['assignment_a'].id}/action/",
        {"action": "confirm"},
        format="json",
    )

    assert response.status_code == 200
    escalados["assignment_a"].refresh_from_db()
    assert escalados["assignment_a"].status == ScheduleAssignment.Status.CONFIRMED
    assert escalados["assignment_a"].responded_at is not None


def test_membro_nao_age_na_escala_de_outro(api_client, escalados):
    api_client.force_authenticate(user=escalados["user_a"])

    response = api_client.post(
        f"/api/me/schedules/{escalados['assignment_b'].id}/action/",
        {"action": "decline", "justification": "Nao e minha escala"},
        format="json",
    )

    # 404 e nao 403: a escala de outro membro nao deve sequer revelar que existe.
    assert response.status_code == 404
    escalados["assignment_b"].refresh_from_db()
    assert escalados["assignment_b"].status == ScheduleAssignment.Status.PENDING


def test_acao_invalida_e_rejeitada(api_client, escalados):
    api_client.force_authenticate(user=escalados["user_a"])

    response = api_client.post(
        f"/api/me/schedules/{escalados['assignment_a'].id}/action/",
        {"action": "talvez"},
        format="json",
    )

    assert response.status_code == 400
    escalados["assignment_a"].refresh_from_db()
    assert escalados["assignment_a"].status == ScheduleAssignment.Status.PENDING


@pytest.mark.parametrize(
    ("action", "justification"),
    [("confirm", ""), ("decline", "Nao poderei ir"), ("unavailable", "Compromisso")],
)
def test_resposta_e_bloqueada_em_escala_cancelada(api_client, escalados, action, justification):
    escala = escalados["assignment_a"].schedule
    escala.status = Schedule.Status.CANCELLED
    escala.save(update_fields=["status"])
    api_client.force_authenticate(user=escalados["user_a"])

    response = api_client.post(
        f"/api/me/schedules/{escalados['assignment_a'].id}/action/",
        {"action": action, "justification": justification},
        format="json",
    )

    assert response.status_code == status.HTTP_409_CONFLICT, response.data
    assert "cancelada" in str(response.data["detail"])
    escalados["assignment_a"].refresh_from_db()
    assert escalados["assignment_a"].status == ScheduleAssignment.Status.PENDING
    assert escalados["assignment_a"].responded_at is None
def test_anonimo_nao_acessa_escalas(api_client, escalados):
    response = api_client.get("/api/me/schedules/")

    assert response.status_code == 401
