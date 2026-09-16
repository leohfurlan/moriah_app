import datetime

import pytest

from apps.events.models import Event
from apps.ministries.models import Ministry, MinistryRole
from apps.schedules.models import PersonalCommitment, Schedule, ScheduleAssignment

pytestmark = pytest.mark.django_db


def test_membro_cria_compromisso_e_so_enxerga_os_proprios(api_client, make_user, make_member):
    user = make_user("membro@igreja.com")
    member = make_member("Maria", user=user)
    other_user = make_user("outro@igreja.com")
    make_member("Joao", user=other_user)
    api_client.force_authenticate(user=user)
    response = api_client.post("/api/me/agenda/", {"title": "Ensaio", "starts_at": "2026-09-20T18:00:00-03:00", "ends_at": "2026-09-20T20:00:00-03:00"}, format="json")
    assert response.status_code == 201
    assert PersonalCommitment.objects.get().member == member
    assert api_client.get("/api/me/agenda/").data[0]["title"] == "Ensaio"


def test_coordenador_publica_escala_do_seu_ministerio(api_client, make_user, make_member, church):
    coordinator = make_user("coord@igreja.com", role="coordinator")
    member = make_member("Maria")
    ministry = Ministry.objects.create(church=church, name="Louvor")
    ministry.coordinators.add(coordinator)
    role = MinistryRole.objects.create(church=church, ministry=ministry, name="Vocal")
    event = Event.objects.create(church=church, name="Culto", start_at=datetime.datetime(2026, 9, 20, 19, tzinfo=datetime.timezone.utc))
    schedule = Schedule.objects.create(church=church, event=event, name="Escala", status=Schedule.Status.DRAFT)
    ScheduleAssignment.objects.create(church=church, schedule=schedule, member=member, ministry_role=role)
    api_client.force_authenticate(user=coordinator)
    response = api_client.post(f"/api/schedules/{schedule.id}/publish/", {}, format="json")
    assert response.status_code == 200
    schedule.refresh_from_db()
    assert schedule.status == Schedule.Status.PUBLISHED
    assert schedule.published_at is not None


def test_confirmacao_recusa_havendo_conflito_de_horario(api_client, make_user, make_member, church):
    user = make_user("membro@igreja.com")
    member = make_member("Maria", user=user)
    ministry = Ministry.objects.create(church=church, name="Louvor")
    role = MinistryRole.objects.create(church=church, ministry=ministry, name="Vocal")
    first_event = Event.objects.create(church=church, name="Culto 1", start_at=datetime.datetime(2026, 9, 20, 19, tzinfo=datetime.timezone.utc))
    second_event = Event.objects.create(church=church, name="Culto 2", start_at=datetime.datetime(2026, 9, 20, 20, tzinfo=datetime.timezone.utc))
    first = Schedule.objects.create(church=church, event=first_event, name="Escala 1")
    second = Schedule.objects.create(church=church, event=second_event, name="Escala 2")
    ScheduleAssignment.objects.create(church=church, schedule=first, member=member, ministry_role=role, status=ScheduleAssignment.Status.CONFIRMED)
    assignment = ScheduleAssignment.objects.create(church=church, schedule=second, member=member, ministry_role=role)
    api_client.force_authenticate(user=user)
    response = api_client.post(f"/api/me/schedules/{assignment.id}/action/", {"action": "confirm"}, format="json")
    assert response.status_code == 409
    assignment.refresh_from_db()
    assert assignment.status == ScheduleAssignment.Status.CONFLICT


def test_coordenador_substitui_integrante_e_preserva_historico(api_client, make_user, make_member, church):
    coordinator = make_user("coord@igreja.com", role="coordinator")
    original_user = make_user("original@igreja.com")
    original_member = make_member("Original", user=original_user)
    replacement = make_member("Substituto")
    ministry = Ministry.objects.create(church=church, name="Louvor")
    ministry.coordinators.add(coordinator)
    role = MinistryRole.objects.create(church=church, ministry=ministry, name="Vocal")
    event = Event.objects.create(church=church, name="Culto", start_at=datetime.datetime(2026, 9, 20, 19, tzinfo=datetime.timezone.utc))
    schedule = Schedule.objects.create(church=church, event=event, name="Escala")
    original = ScheduleAssignment.objects.create(church=church, schedule=schedule, member=original_member, ministry_role=role)
    api_client.force_authenticate(user=coordinator)
    response = api_client.post(f"/api/schedules/{schedule.id}/assignments/{original.id}/substitute/", {"member_id": replacement.id, "justification": "Indisponibilidade"}, format="json")
    assert response.status_code == 201
    original.refresh_from_db()
    replacement_assignment = ScheduleAssignment.objects.get(substitution_for=original)
    assert original.status == ScheduleAssignment.Status.REPLACEMENT_NEEDED
    assert replacement_assignment.member == replacement