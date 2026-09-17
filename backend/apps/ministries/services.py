"""Escopo de administracao por ministerio.

Regra de produto (docs/architecture/capacidades-mvp.md, lacuna C1): o
coordenador so enxerga e operacao o ministerio que coordena. Quem tem papel de
lideranca (admin/pastor) opera todos os ministerios da propria igreja.
"""
from .models import Ministry

MANAGE_ALL_ROLES = ("admin", "pastor")


def managed_ministries(user):
    """Ministerios que a conta administra, sempre dentro da propria igreja."""
    if user is None or not getattr(user, "is_authenticated", False) or user.church_id is None:
        return Ministry.objects.none()
    queryset = Ministry.objects.filter(church=user.church)
    if user.is_superuser or user.has_role(*MANAGE_ALL_ROLES):
        return queryset
    if user.has_role(user.Role.COORDINATOR):
        return queryset.filter(coordinators=user)
    return queryset.none()


def can_manage_ministry(user, ministry) -> bool:
    if user is None or not getattr(user, "is_authenticated", False) or ministry is None:
        return False
    if ministry.church_id != user.church_id:
        return False
    return managed_ministries(user).filter(pk=ministry.pk).exists()
