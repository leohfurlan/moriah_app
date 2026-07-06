"""Testes de auditoria dos 3 eventos monitorados."""
import datetime

import pytest

from apps.accounts.models import User
from apps.audit.middleware import set_current_user
from apps.audit.models import AuditLog
from apps.events.models import Event
from apps.finance.models import Contribution
from apps.ministries.models import Ministry, MinistryRole
from apps.schedules.models import Schedule, ScheduleAssignment
from conftest import DEFAULT_PASSWORD

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _reset_current_user():
    """Garante que o usuario por thread nao vaze entre testes."""
    yield
    set_current_user(None)


def test_mudanca_de_status_de_contribuicao_gera_auditoria(make_user, make_member):
    tesoureiro = make_user("tesoureiro@igreja.com", role=User.Role.TREASURER)
    membro = make_member("Membro Contribuinte")
    contrib = Contribution.objects.create(
        church=membro.church,
        member=membro,
        category=Contribution.Category.TITHE,
        amount="150.00",
        contribution_date=datetime.date(2026, 7, 1),
    )

    set_current_user(tesoureiro)
    contrib.status = Contribution.Status.APPROVED
    contrib.save()

    log = AuditLog.objects.get(model_name="Contribution", object_id=str(contrib.id))
    assert log.action == "contribution_status_changed"
    assert log.user == tesoureiro
    assert log.church == membro.church
    assert log.payload["before"]["status"] == Contribution.Status.PENDING
    assert log.payload["after"]["status"] == Contribution.Status.APPROVED


def test_edicao_de_dados_de_membro_gera_auditoria(make_user, make_member):
    secretaria = make_user("secretaria@igreja.com", role=User.Role.SECRETARY)
    membro = make_member("Nome Antigo", phone="1111")

    set_current_user(secretaria)
    membro.full_name = "Nome Novo"
    membro.phone = "2222"
    membro.save()

    log = AuditLog.objects.get(model_name="Member", object_id=str(membro.id))
    assert log.action == "member_updated"
    assert log.user == secretaria
    assert log.payload["before"]["full_name"] == "Nome Antigo"
    assert log.payload["after"]["full_name"] == "Nome Novo"
    assert log.payload["before"]["phone"] == "1111"
    assert log.payload["after"]["phone"] == "2222"


def test_confirmacao_de_escala_gera_auditoria(api_client, make_user, make_member):
    user = make_user("escalado@igreja.com")
    membro = make_member("Membro Escalado", user=user)
    church = membro.church
    evento = Event.objects.create(
        church=church,
        name="Culto de Domingo",
        start_at=datetime.datetime(2026, 7, 12, 19, 0, tzinfo=datetime.timezone.utc),
    )
    escala = Schedule.objects.create(church=church, event=evento, name="Louvor")
    ministerio = Ministry.objects.create(church=church, name="Ministerio de Louvor")
    funcao = MinistryRole.objects.create(church=church, ministry=ministerio, name="Vocal")
    assignment = ScheduleAssignment.objects.create(
        church=church,
        schedule=escala,
        member=membro,
        ministry_role=funcao,
    )

    # Fluxo real: login via JWT + endpoint de acao (exercita o middleware).
    token = api_client.post(
        "/api/auth/login/",
        {"email": user.email, "password": DEFAULT_PASSWORD},
        format="json",
    ).data["access"]
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    response = api_client.post(
        f"/api/me/schedules/{assignment.id}/action/",
        {"action": "confirm"},
        format="json",
    )

    assert response.status_code == 200
    log = AuditLog.objects.get(model_name="ScheduleAssignment", object_id=str(assignment.id))
    assert log.action == "schedule_assignment_confirmed"
    assert log.user == user
    assert log.payload["before"]["status"] == ScheduleAssignment.Status.PENDING
    assert log.payload["after"]["status"] == ScheduleAssignment.Status.CONFIRMED


def test_recusa_de_escala_gera_auditoria(api_client, make_user, make_member):
    user = make_user("recusado@igreja.com")
    membro = make_member("Membro Recusa", user=user)
    church = membro.church
    evento = Event.objects.create(
        church=church,
        name="Culto de Quarta",
        start_at=datetime.datetime(2026, 7, 15, 20, 0, tzinfo=datetime.timezone.utc),
    )
    escala = Schedule.objects.create(church=church, event=evento, name="Recepcao")
    ministerio = Ministry.objects.create(church=church, name="Ministerio de Recepcao")
    funcao = MinistryRole.objects.create(church=church, ministry=ministerio, name="Porta")
    assignment = ScheduleAssignment.objects.create(
        church=church,
        schedule=escala,
        member=membro,
        ministry_role=funcao,
    )

    token = api_client.post(
        "/api/auth/login/",
        {"email": user.email, "password": DEFAULT_PASSWORD},
        format="json",
    ).data["access"]
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    response = api_client.post(
        f"/api/me/schedules/{assignment.id}/action/",
        {"action": "decline", "justification": "Estarei viajando"},
        format="json",
    )

    assert response.status_code == 200
    log = AuditLog.objects.get(model_name="ScheduleAssignment", object_id=str(assignment.id))
    assert log.action == "schedule_assignment_declined"
    assert log.user == user
    assert log.payload["after"]["status"] == ScheduleAssignment.Status.DECLINED
