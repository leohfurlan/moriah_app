from rest_framework.permissions import BasePermission

from .models import User


class IsTreasurerOrAdmin(BasePermission):
    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (user.is_superuser or user.role in {User.Role.ADMIN, User.Role.TREASURER})
        )


class IsCellLeaderOrAdmin(BasePermission):
    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (user.is_superuser or user.role in {User.Role.ADMIN, User.Role.CELL_LEADER})
        )
