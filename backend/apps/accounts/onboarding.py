"""Deterministic personal onboarding and church configuration progress."""
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from .models import Church, ChurchSetup, OnboardingProfile, User, WhatsAppIdentity
from .permissions import get_member_profile, is_admin_user


def profile_for(user):
    member = get_member_profile(user)
    defaults = {"birth_date": member.birth_date if member else None}
    return OnboardingProfile.objects.get_or_create(user=user, defaults=defaults)[0]


def require_church(user):
    if not user.church_id:
        raise PermissionDenied("Sua conta não está associada a uma igreja.")


def personal_state(user):
    from apps.members.models import Member, MemberLinkRequest
    profile = profile_for(user)
    member = get_member_profile(user)
    latest = MemberLinkRequest.objects.filter(user=user, church_id=user.church_id).first()
    confirmed = bool(member and member.status != Member.Status.VISITOR)
    state = "confirmed" if confirmed else latest.status if latest else "none"
    if state == "approved":
        state = "none"  # A historical approval cannot replace a current link.
    actions = [{"key": "cultos", "label": "Horários dos cultos", "route": "/service-times"},
               {"key": "eventos", "label": "Próximos eventos", "route": "/welcome"}]
    if profile.relationship == "attending":
        actions.append({"key": "celula", "label": "Como participar de uma célula", "route": "/welcome"})
    if profile.relationship == "member":
        actions.append({"key": "perfil", "label": "Conferência do cadastro", "route": "/profile"})
    if is_admin_user(user):
        actions.append({"key": "setup", "label": "Configurar a igreja", "route": "/settings"})
    return {
        "version": 1, "journey": "admin" if is_admin_user(user) else "personal",
        "step": profile.step,
        "status": "completed" if profile.completed_at else "not_started" if profile.step == "welcome" else "in_progress",
        "profile": {"name": user.get_full_name(), "email": user.email,
                    "birth_date": profile.birth_date, "relationship": profile.relationship or None},
        "whatsapp_verified": WhatsAppIdentity.objects.filter(user=user, church_id=user.church_id).exists(),
        "completed_at": profile.completed_at,
        "member_link": {"state": state, "request_id": latest.pk if latest else None},
        "next_actions": actions,
    }


@transaction.atomic
def save_personal(user, values):
    user = User.objects.select_for_update().get(pk=user.pk)
    require_church(user)
    profile = profile_for(user)
    if profile.completed_at:
        raise ValidationError("A acolhida já foi concluída. Solicite alterações pelo Perfil.")
    if "name" in values:
        first, _, last = values.pop("name").strip().partition(" ")
        user.first_name, user.last_name = first, last
        user.save(update_fields=("first_name", "last_name", "updated_at"))
    for key, value in values.items():
        setattr(profile, key, value)
    profile.save()
    return personal_state(user)


@transaction.atomic
def complete_personal(user):
    from apps.members.linking import open_request
    from apps.members.models import Member, MemberUpdateRequest
    user = User.objects.select_for_update().get(pk=user.pk)
    require_church(user)
    profile = profile_for(user)
    if profile.completed_at:
        return personal_state(user)
    errors = {}
    if not user.get_full_name().strip():
        errors["name"] = ["Informe seu nome completo."]
    if not user.email:
        errors["email"] = ["Informe um e-mail no cadastro."]
    if not profile.birth_date or profile.birth_date > timezone.localdate():
        errors["birth_date"] = ["Informe uma data de nascimento válida até hoje."]
    if not profile.relationship:
        errors["relationship"] = ["Informe sua relação com a Moriah."]
    if not WhatsAppIdentity.objects.filter(user=user, church_id=user.church_id).exists():
        errors["whatsapp"] = ["Vincule e verifique seu WhatsApp para continuar."]
    if errors:
        raise ValidationError(errors)
    member = Member.objects.filter(user=user).first()
    if profile.relationship == "member" and (not member or member.status == Member.Status.VISITOR):
        open_request(user)
    if member and member.birth_date != profile.birth_date:
        changes = {"birth_date": profile.birth_date.isoformat()}
        MemberUpdateRequest.objects.get_or_create(
            church_id=user.church_id, member=member, status="pending", requested_changes=changes,
        )
    profile.completed_at = timezone.now()
    profile.step = "done"
    profile.save()
    return personal_state(user)


def setup_conditions(church_id, setup):
    from apps.cells.models import Cell
    from apps.events.models import Event, ServiceTime
    from apps.ministries.models import Ministry
    return [bool(setup and setup.church_reviewed_at), bool(setup and setup.team_reviewed_at),
            ServiceTime.objects.filter(church_id=church_id, active=True).exists(),
            Event.objects.filter(church_id=church_id, active=True).exists(),
            Cell.objects.filter(church_id=church_id).exists(),
            Ministry.objects.filter(church_id=church_id).exists()]


@transaction.atomic
def invalidate_dismissals(church_id):
    """Also called on record changes: regressions must survive between reads."""
    if not Church.objects.select_for_update().filter(pk=church_id).exists():
        return
    setup = ChurchSetup.objects.filter(church_id=church_id).first()
    if not all(setup_conditions(church_id, setup)):
        OnboardingProfile.objects.filter(user__church_id=church_id, setup_dismissed=True).update(setup_dismissed=False)


@transaction.atomic
def setup_state(user):
    require_church(user)
    if not is_admin_user(user):
        raise PermissionDenied("A configuração da igreja é exclusiva da administração.")
    Church.objects.select_for_update().get(pk=user.church_id)
    setup, _ = ChurchSetup.objects.get_or_create(church_id=user.church_id)
    conditions = setup_conditions(user.church_id, setup)
    count = sum(conditions)
    if count < 6:
        invalidate_dismissals(user.church_id)
    profile = profile_for(user)
    keys = ("church_review", "team_review", "service_times", "first_event", "first_cell", "first_ministry")
    labels = ("Revisar dados da igreja", "Conferir equipe e permissões", "Cadastrar horários dos cultos",
              "Publicar primeiro evento", "Cadastrar primeira célula", "Cadastrar primeiro ministério")
    urls = ("/settings/church", "/settings/team", "/service-times",
            "/settings/events", "/settings/cells", "/settings/ministries")
    items = []
    for index, key in enumerate(keys):
        url = urls[index]
        items.append({"key": key, "label": labels[index], "completed": conditions[index],
                      "mode": "confirmation" if index < 2 else "automatic", "action_url": url})
    return {"completed_count": count, "total_count": 6, "percentage": (count * 100 + 3) // 6,
            "card_visible": count < 6 or not profile.setup_dismissed, "items": items}


@transaction.atomic
def setup_action(user, item=None, dismiss=False):
    require_church(user)
    if not is_admin_user(user):
        raise PermissionDenied("A configuração da igreja é exclusiva da administração.")
    Church.objects.select_for_update().get(pk=user.church_id)
    setup, _ = ChurchSetup.objects.get_or_create(church_id=user.church_id)
    if dismiss:
        from apps.members.linking import LinkConflict
        if not all(setup_conditions(user.church_id, setup)):
            raise LinkConflict("Conclua os seis itens antes de dispensar o card.")
        OnboardingProfile.objects.filter(pk=profile_for(user).pk).update(setup_dismissed=True)
    else:
        prefix = {"church_review": "church", "team_review": "team"}[item]
        if not getattr(setup, f"{prefix}_reviewed_at"):
            setattr(setup, f"{prefix}_reviewed_at", timezone.now())
            setattr(setup, f"{prefix}_reviewed_by", user)
            setup.save()
    return setup_state(user)
