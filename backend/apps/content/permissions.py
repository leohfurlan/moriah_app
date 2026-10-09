from rest_framework.permissions import BasePermission
from apps.accounts.models import User
from apps.accounts.permissions import get_member_profile


def can_manage_content(user):
    return bool(user.is_authenticated and (user.is_superuser or user.has_role(User.Role.ADMIN, User.Role.PASTOR)))


class CanAccessContent(BasePermission):
    message = "Conteúdo exige vínculo de membro ou permissão de publicação na sua igreja."

    def has_permission(self, request, view):
        user = request.user
        if not user.is_authenticated or not user.church_id:
            return False
        if request.method in ("GET", "HEAD", "OPTIONS"):
            member = get_member_profile(user)
            return can_manage_content(user) or bool(member and member.church_id == user.church_id)
        return can_manage_content(user)
