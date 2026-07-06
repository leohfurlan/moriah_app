"""Signals que gravam eventos relevantes no ``AuditLog``.

Eventos auditados:
- Contribution: mudanca de status.
- Member: edicao de dados cadastrais.
- ScheduleAssignment: confirmacao ou recusa.

Optamos por signals (em vez de ``save()`` explicito) porque as alteracoes
podem ocorrer em varios pontos (API, Django admin, comandos), e os signals
capturam todos eles de forma centralizada. O usuario responsavel vem do
``CurrentUserMiddleware`` via armazenamento por thread.
"""
import datetime
from decimal import Decimal

from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from apps.finance.models import Contribution
from apps.members.models import Member
from apps.schedules.models import ScheduleAssignment

from .middleware import get_current_user
from .models import AuditLog

# Campos cadastrais do Member cuja edicao deve ser auditada.
MEMBER_TRACKED_FIELDS = (
    "full_name",
    "preferred_name",
    "email",
    "phone",
    "birth_date",
    "address",
    "marital_status",
    "status",
    "joined_at",
    "notes",
    "family_id",
    "cell_id",
)


def _json_safe(value):
    """Converte valores para tipos serializaveis em JSONField."""
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, (datetime.date, datetime.datetime)):
        return value.isoformat()
    return str(value)


# --- Contribution: mudanca de status ---------------------------------------


@receiver(pre_save, sender=Contribution)
def _cache_contribution_status(sender, instance, **kwargs):
    if instance.pk:
        instance._audit_old_status = (
            sender.objects.filter(pk=instance.pk).values_list("status", flat=True).first()
        )
    else:
        instance._audit_old_status = None


@receiver(post_save, sender=Contribution)
def _log_contribution_status(sender, instance, created, **kwargs):
    if created:
        return
    old_status = getattr(instance, "_audit_old_status", None)
    if old_status is None or old_status == instance.status:
        return
    AuditLog.objects.create(
        church=instance.church,
        user=get_current_user(),
        action="contribution_status_changed",
        model_name="Contribution",
        object_id=str(instance.pk),
        payload={
            "before": {"status": old_status},
            "after": {"status": instance.status},
        },
    )


# --- Member: edicao de dados cadastrais ------------------------------------


@receiver(pre_save, sender=Member)
def _cache_member_state(sender, instance, **kwargs):
    if instance.pk:
        instance._audit_old_member = sender.objects.filter(pk=instance.pk).first()
    else:
        instance._audit_old_member = None


@receiver(post_save, sender=Member)
def _log_member_update(sender, instance, created, **kwargs):
    if created:
        return
    old = getattr(instance, "_audit_old_member", None)
    if old is None:
        return
    before, after = {}, {}
    for field in MEMBER_TRACKED_FIELDS:
        old_value = getattr(old, field)
        new_value = getattr(instance, field)
        if old_value != new_value:
            before[field] = _json_safe(old_value)
            after[field] = _json_safe(new_value)
    if not before:
        return
    AuditLog.objects.create(
        church=instance.church,
        user=get_current_user(),
        action="member_updated",
        model_name="Member",
        object_id=str(instance.pk),
        payload={"before": before, "after": after},
    )


# --- ScheduleAssignment: confirmacao / recusa ------------------------------


@receiver(pre_save, sender=ScheduleAssignment)
def _cache_assignment_status(sender, instance, **kwargs):
    if instance.pk:
        instance._audit_old_status = (
            sender.objects.filter(pk=instance.pk).values_list("status", flat=True).first()
        )
    else:
        instance._audit_old_status = None


@receiver(post_save, sender=ScheduleAssignment)
def _log_assignment_response(sender, instance, created, **kwargs):
    if created:
        return
    old_status = getattr(instance, "_audit_old_status", None)
    if old_status is None or old_status == instance.status:
        return
    if instance.status == ScheduleAssignment.Status.CONFIRMED:
        action = "schedule_assignment_confirmed"
    elif instance.status == ScheduleAssignment.Status.DECLINED:
        action = "schedule_assignment_declined"
    else:
        return
    AuditLog.objects.create(
        church=instance.church,
        user=get_current_user(),
        action=action,
        model_name="ScheduleAssignment",
        object_id=str(instance.pk),
        payload={
            "before": {"status": old_status},
            "after": {"status": instance.status},
        },
    )
