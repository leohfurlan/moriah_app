"""Regras de escopo, conflito e ciclo de vida das escalas.

Fica fora das views porque serializers e views precisam exatamente da mesma
decisao (quem administra o que, o que conta como choque de horario). Duplicar
essa logica foi o que deixou a criacao de escala fora do escopo de ministerio
na Fase 1 (capacidade C1 em docs/architecture/capacidades-mvp.md).
"""
from datetime import timedelta

from django.db import models

from apps.ministries.services import can_manage_ministry, managed_ministries

from .models import PersonalCommitment, Schedule, ScheduleAssignment

# Janela assumida quando o evento nao declara horario de termino.
DEFAULT_EVENT_HOURS = 2
# Janela assumida quando o compromisso pessoal nao declara horario de termino.
DEFAULT_COMMITMENT_HOURS = 1

# Situacoes em que o integrante continua ocupado no horario da outra escala.
BUSY_ASSIGNMENT_STATUSES = (
    ScheduleAssignment.Status.PENDING,
    ScheduleAssignment.Status.CONFIRMED,
    ScheduleAssignment.Status.CONFLICT,
)

MANAGE_ALL_ROLES = ("admin", "pastor")


def publication_error(schedule_status, has_assignments) -> str | None:
    """Retorna o motivo que impede publicar uma escala, se houver."""
    if schedule_status == Schedule.Status.CANCELLED:
        return "Uma escala cancelada nao pode ser publicada."
    if not has_assignments:
        return "Inclua ao menos um integrante antes de publicar a escala."
    return None


def event_window(event):
    """Inicio e fim efetivos de um evento."""
    start = event.start_at
    end = event.end_at or start + timedelta(hours=DEFAULT_EVENT_HOURS)
    return start, end


def overlaps(start, end, other_start, other_end) -> bool:
    return start < other_end and other_start < end



def can_manage_schedule(user, schedule) -> bool:
    """Coordenador so administra escala do ministerio que coordena.

    Escalas antigas sem ministerio declarado seguem valendo pela funcao dos
    integrantes, para nao travar dado criado antes deste campo existir.
    """
    if user is None or not user.is_authenticated or schedule is None:
        return False
    if schedule.church_id != user.church_id:
        return False
    if user.is_superuser or user.has_role(*MANAGE_ALL_ROLES):
        return True
    if not user.has_role(user.Role.COORDINATOR):
        return False
    if schedule.ministry_id and can_manage_ministry(user, schedule.ministry):
        return True
    return schedule.assignments.filter(ministry_role__ministry__coordinators=user).exists()


def managed_schedules(user):
    """Escalas visiveis na tela de gestao, sempre da igreja da conta."""
    if user is None or not user.is_authenticated or user.church_id is None:
        return Schedule.objects.none()
    queryset = Schedule.objects.filter(church=user.church)
    if user.is_superuser or user.has_role(*MANAGE_ALL_ROLES):
        return queryset
    if not user.has_role(user.Role.COORDINATOR):
        return queryset.none()
    ministry_ids = managed_ministries(user).values_list("id", flat=True)
    return queryset.filter(
        models.Q(ministry_id__in=ministry_ids)
        | models.Q(assignments__ministry_role__ministry_id__in=ministry_ids)
    ).distinct()


def overlapping_assignments(member, schedule):
    """Outras escalas do membro que ocupam o mesmo horario."""
    start, end = event_window(schedule.event)
    candidates = (
        ScheduleAssignment.objects.filter(church=schedule.church, member=member, status__in=BUSY_ASSIGNMENT_STATUSES)
        .exclude(schedule_id=schedule.pk)
        .exclude(schedule__status=Schedule.Status.CANCELLED)
        .select_related("schedule__event")
    )
    return [other for other in candidates if overlaps(start, end, *event_window(other.schedule.event))]


def overlapping_commitments(member, schedule):
    """Compromissos pessoais do membro que ocupam o mesmo horario."""
    start, end = event_window(schedule.event)
    commitments = PersonalCommitment.objects.filter(
        church=schedule.church,
        member=member,
        status=PersonalCommitment.Status.PLANNED,
    )
    return [
        commitment
        for commitment in commitments
        if overlaps(
            start,
            end,
            commitment.starts_at,
            commitment.ends_at or commitment.starts_at + timedelta(hours=DEFAULT_COMMITMENT_HOURS),
        )
    ]


def conflict_reason(member, schedule) -> str:
    """Motivo textual do choque de agenda, ou string vazia quando esta livre."""
    reasons = []
    for other in overlapping_assignments(member, schedule):
        reasons.append(f"Ja escalado em {other.schedule.name} ({other.schedule.event.name}).")
    for commitment in overlapping_commitments(member, schedule):
        reasons.append(f"Compromisso pessoal no mesmo horario: {commitment.title}.")
    return " ".join(reasons)


def add_assignment(schedule, member, ministry_role, justification="", extra=None):
    """Escala um integrante ja marcando conflito de agenda, quando houver."""
    reason = conflict_reason(member, schedule)
    return ScheduleAssignment.objects.create(
        church=schedule.church,
        schedule=schedule,
        member=member,
        ministry_role=ministry_role,
        justification=justification or "",
        status=ScheduleAssignment.Status.CONFLICT if reason else ScheduleAssignment.Status.PENDING,
        conflict_reason=reason,
        **(extra or {}),
    )
