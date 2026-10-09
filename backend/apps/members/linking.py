"""Transactional member/account linking; shared by API, admin and recovery."""
import logging

from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import APIException, PermissionDenied, ValidationError

from apps.accounts.models import User
from apps.accounts.permissions import user_capabilities
from apps.audit.models import AuditLog, Notification
from .models import Member, MemberLinkRequest

logger = logging.getLogger(__name__)


class LinkConflict(APIException):
    status_code = 409
    default_detail = "A solicitação ou o cadastro mudou. Atualize antes de continuar."


def can_review(user):
    return bool(user.is_active and user.church_id and
                {"manage_members", "manage_all"}.intersection(user_capabilities(user)))


def notify_reviewers(item):
    count = 0
    found = False
    for reviewer in User.objects.filter(church_id=item.church_id, is_active=True):
        if not can_review(reviewer):
            continue
        found = True
        _, created = Notification.objects.get_or_create(
            dedupe_key=f"member-link:{item.pk}:opened:{reviewer.pk}",
            defaults=dict(church_id=item.church_id, recipient=reviewer,
                          category="member_link", title="Solicitação de vínculo cadastral",
                          body=f"{item.user.get_full_name() or item.requested_email} solicita revisão do cadastro.",
                          action_label="Revisar solicitação", action_route=f"/member-link-requests/{item.pk}"),
        )
        count += int(created)
    if not found:
        logger.warning("member_link_no_reviewer church_id=%s request_id=%s", item.church_id, item.pk)
    return count


@transaction.atomic
def open_request(user):
    # Serialize all opening/review operations for this account, including retries.
    user = User.objects.select_for_update().get(pk=user.pk)
    if not user.church_id:
        raise ValidationError("A conta não está associada a uma igreja.")
    if Member.objects.filter(user=user).exclude(status=Member.Status.VISITOR).exists():
        raise LinkConflict("Esta conta já está vinculada a um cadastro de membro.")
    pending = MemberLinkRequest.objects.filter(user=user, church_id=user.church_id, status="pending").first()
    if pending:
        notify_reviewers(pending)
        return pending, False
    candidates = Member.objects.filter(church_id=user.church_id, email__iexact=user.email, user__isnull=True)
    # An email match is only a suggestion and never proves identity.
    candidate = candidates.first() if candidates.count() == 1 else None
    item = MemberLinkRequest.objects.create(church_id=user.church_id, user=user,
                                           requested_email=user.email, candidate_member=candidate)
    AuditLog.objects.create(church_id=user.church_id, user=user, action="member_link_requested",
                            model_name="MemberLinkRequest", object_id=str(item.pk))
    notify_reviewers(item)
    return item, True


def validate_decision(actor, item, decision, candidate, notes):
    if not can_review(actor) or actor.church_id != item.church_id:
        raise PermissionDenied("Você não pode revisar solicitações desta igreja.")
    if decision not in {"approved", "rejected"}:
        raise ValidationError("Escolha aprovar ou rejeitar.")
    if item.status != "pending":
        if item.status == decision and (decision == "rejected" or item.candidate_member_id == getattr(candidate, 'pk', None)):
            return False
        raise LinkConflict()
    if decision == "rejected":
        if not notes.strip():
            raise ValidationError("Informe o motivo da rejeição.")
        return True
    if candidate is None or candidate.church_id != item.church_id:
        raise ValidationError("Selecione um cadastro de membro da mesma igreja.")
    if candidate.user_id not in (None, item.user_id):
        raise LinkConflict("Este cadastro já está vinculado a outra conta.")
    if Member.objects.filter(user_id=item.user_id).exclude(pk=candidate.pk).exclude(status=Member.Status.VISITOR).exists():
        raise LinkConflict("A conta já está vinculada a outro cadastro.")
    return True


def attach_reviewed_member(item, candidate):
    """Human-approved merge; keep visitor activity and official fields."""
    from apps.cells.models import CellAttendance
    from apps.finance.models import Contribution, FinancialEntry
    from apps.schedules.models import ScheduleAssignment, PersonalCommitment, WorshipTeamMember
    from .models import MemberUpdateRequest, FamilyRelationship
    previous = Member.objects.select_for_update().filter(user_id=item.user_id).exclude(pk=candidate.pk).first()
    try:
        with transaction.atomic():
            if previous:
                if previous.status != Member.Status.VISITOR:
                    raise LinkConflict()
                for model, field in ((CellAttendance, "member"), (Contribution, "member"),
                                     (FinancialEntry, "member"), (ScheduleAssignment, "member"),
                                     (PersonalCommitment, "member"), (WorshipTeamMember, "member"),
                                     (MemberUpdateRequest, "member"), (FamilyRelationship, "member"),
                                     (FamilyRelationship, "related_member")):
                    model.objects.filter(**{field: previous}).update(**{field: candidate})
                for ministry in previous.ministries.all():
                    ministry.members.add(candidate)
                    ministry.members.remove(previous)
                previous.user = None
                previous.save(update_fields=("user", "updated_at"))
            candidate.user_id = item.user_id
            if candidate.status == Member.Status.VISITOR:
                candidate.status = Member.Status.ACTIVE
            candidate.save(update_fields=("user", "status", "updated_at"))
    except IntegrityError:
        raise LinkConflict("Há registros conflitantes entre os cadastros. A secretaria deve conciliá-los antes de aprovar.") from None


@transaction.atomic
def review_request(actor, pk, decision, candidate_id=None, notes=""):
    original = MemberLinkRequest.objects.get(pk=pk, church_id=actor.church_id)
    User.objects.select_for_update().get(pk=original.user_id)
    item = MemberLinkRequest.objects.select_for_update().get(pk=pk)
    candidate = Member.objects.select_for_update().filter(pk=candidate_id, church_id=item.church_id).first() if candidate_id else None
    if not validate_decision(actor, item, decision, candidate, notes):
        return item
    if decision == "approved":
        attach_reviewed_member(item, candidate)
        item.candidate_member = candidate
    item.status = decision
    item.review_notes = notes.strip()
    item.reviewed_by = actor
    item.reviewed_at = timezone.now()
    item.save()
    AuditLog.objects.create(church_id=item.church_id, user=actor, action=f"member_link_{decision}",
                            model_name="MemberLinkRequest", object_id=str(item.pk),
                            payload={"candidate_member_id": item.candidate_member_id, "review_notes": item.review_notes})
    Notification.objects.get_or_create(
        dedupe_key=f"member-link:{item.pk}:decided:{item.user_id}",
        defaults=dict(church_id=item.church_id, recipient_id=item.user_id, category="member_link",
                      title="Vínculo cadastral aprovado" if decision == "approved" else "Vínculo cadastral não aprovado",
                      body="Seu cadastro foi vinculado. Confira seu Perfil." if decision == "approved" else item.review_notes,
                      action_label="Ver meu Perfil", action_route="/profile"),
    )
    return item
