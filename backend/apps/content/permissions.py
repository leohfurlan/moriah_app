from rest_framework.permissions import BasePermission

from apps.accounts.models import User
from apps.accounts.permissions import get_member_profile


class CanAccessContent(BasePermission):
    message = "Conteúdo exige vínculo de membro ou permissão de publicação na sua igreja."

    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (
                get_member_profile(user) is not None
                or user.is_superuser
                or user.has_role(User.Role.ADMIN, User.Role.PASTOR)
            )
        )

    def has_object_permission(self, request, view, obj) -> bool:
        return obj.church_id == request.user.church_id


def can_manage_content(user) -> bool:
    return bool(user.is_superuser or user.has_role(User.Role.ADMIN, User.Role.PASTOR))
