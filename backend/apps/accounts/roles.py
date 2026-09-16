"""Mapeamento de papel (``User.Role``) para grupos e permissoes do Django Admin.

Por que isso existe: o PRD decidiu que a operacao do MVP acontece no Django
Admin (secao 15). Marcar o usuario como ``is_staff`` apenas abre a porta do
admin — sem permissoes de modelo, tesouraria e secretaria entram e nao veem
absolutamente nada. Este modulo traduz a secao 6 do PRD ("Regras de
Permissao") em grupos reais, para que cada papel enxergue no admin exatamente
o que lhe cabe.

Principios aplicados:
- Tesouraria mexe em financeiro e apenas consulta membros (para identificar
  quem contribuiu), sem editar cadastro.
- Secretaria cadastra pessoas, celulas e eventos e **nao acessa financeiro**
  (o PRD trata valor individual como dado restrito).
- Coordenacao cuida de ministerios, eventos e escalas, sem financeiro.
- Pastor tem visao ampla de leitura, incluindo a trilha de auditoria.
- Admin/superusuario nao usa grupo: ja tem acesso total.
- Lider de celula opera pelo app, nao pelo admin.
"""
from django.contrib.auth.models import Group, Permission
from django.contrib.contenttypes.models import ContentType

from .models import User

VIEW = ("view",)
MANAGE = ("add", "change", "view")
FULL = ("add", "change", "delete", "view")

# Grupo -> {"app_label.modelo": (acoes,)}
ROLE_GROUPS: dict[str, dict[str, tuple[str, ...]]] = {
    "Tesouraria": {
        "finance.contribution": MANAGE,
        "finance.contributionattachment": FULL,
        "members.member": VIEW,
        "accounts.church": VIEW,
    },
    "Secretaria": {
        "members.member": MANAGE,
        "members.family": MANAGE,
        "members.memberupdaterequest": FULL,
        "members.familyrelationship": FULL,
        "cells.cell": MANAGE,
        "cells.cellmeeting": MANAGE,
        "cells.cellattendance": FULL,
        "events.event": MANAGE,
        "ministries.ministry": VIEW,
        "ministries.ministryrole": VIEW,
        "accounts.church": VIEW,
    },
    "Coordenacao de Ministerio": {
        "ministries.ministry": MANAGE,
        "ministries.ministryrole": MANAGE,
        "events.event": MANAGE,
        "schedules.schedule": MANAGE,
        "schedules.song": FULL,
        "schedules.worshipteam": FULL,
        "schedules.worshipteammember": FULL,
        "schedules.personalcommitment": VIEW,
        "schedules.scheduleassignment": FULL,
        "schedules.scheduleitem": FULL,
        "members.member": VIEW,
        "accounts.church": VIEW,
    },
    "Pastoral": {
        "members.member": MANAGE,
        "members.family": VIEW,
        "cells.cell": MANAGE,
        "cells.cellmeeting": VIEW,
        "cells.cellattendance": VIEW,
        "ministries.ministry": MANAGE,
        "ministries.ministryrole": MANAGE,
        "events.event": MANAGE,
        "schedules.schedule": MANAGE,
        "schedules.scheduleassignment": VIEW,
        "schedules.scheduleitem": VIEW,
        "schedules.song": VIEW,
        "schedules.worshipteam": VIEW,
        "schedules.worshipteammember": VIEW,
        "schedules.personalcommitment": VIEW,
        "audit.auditlog": VIEW,
        "accounts.church": VIEW,
    },
}

# Papel -> grupo. Papeis ausentes nao acessam o admin.
ROLE_TO_GROUP: dict[str, str] = {
    User.Role.TREASURER: "Tesouraria",
    User.Role.SECRETARY: "Secretaria",
    User.Role.COORDINATOR: "Coordenacao de Ministerio",
    User.Role.PASTOR: "Pastoral",
}

# Papeis que operam pelo Django Admin e portanto precisam de ``is_staff``.
STAFF_ROLES = frozenset(ROLE_TO_GROUP) | {User.Role.ADMIN}


def _permissions_for(spec: dict[str, tuple[str, ...]]) -> list[Permission]:
    permissions: list[Permission] = []
    for label, actions in spec.items():
        app_label, model = label.split(".")
        content_type = ContentType.objects.get(app_label=app_label, model=model)
        for action in actions:
            permissions.append(
                Permission.objects.get(
                    content_type=content_type,
                    codename=f"{action}_{model}",
                )
            )
    return permissions


def sync_groups() -> dict[str, Group]:
    """Cria/atualiza os grupos de papel com suas permissoes.

    Idempotente: pode rodar a cada deploy. As permissoes sao **substituidas**
    (``set``), entao remover um modelo de ``ROLE_GROUPS`` revoga o acesso.
    """
    groups: dict[str, Group] = {}
    for name, spec in ROLE_GROUPS.items():
        group, _ = Group.objects.get_or_create(name=name)
        group.permissions.set(_permissions_for(spec))
        groups[name] = group
    return groups


def apply_role(user: User, groups: dict[str, Group] | None = None) -> None:
    """Alinha ``is_staff`` e os grupos de um usuario ao seu papel.

    Superusuario nao e tocado: ja tem acesso total e mexer em ``is_staff``
    dele so criaria risco de trancar o administrador para fora.
    """
    if user.is_superuser:
        return

    groups = groups if groups is not None else {g.name: g for g in Group.objects.all()}
    role_values = user.assigned_roles()
    group_names = {ROLE_TO_GROUP[role] for role in role_values if role in ROLE_TO_GROUP}

    # Remove apenas grupos gerenciados por este modulo, preservando grupos
    # criados manualmente pela equipe no admin.
    managed = set(ROLE_GROUPS)
    current = [g for g in user.groups.all() if g.name not in managed]
    current.extend(groups[name] for name in sorted(group_names) if name in groups)
    user.groups.set(current)

    should_be_staff = bool(role_values.intersection(STAFF_ROLES))
    if user.is_staff != should_be_staff:
        user.is_staff = should_be_staff
        user.save(update_fields=["is_staff", "updated_at"])


def sync_role_permissions() -> tuple[int, int]:
    """Sincroniza grupos e reaplica o papel de todos os usuarios.

    Retorna ``(grupos, usuarios)`` afetados.
    """
    groups = sync_groups()
    users = User.objects.exclude(is_superuser=True)
    for user in users:
        apply_role(user, groups)
    return len(groups), users.count()
