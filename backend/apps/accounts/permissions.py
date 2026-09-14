from rest_framework.permissions import BasePermission

from .models import User


def get_member_profile(user):
    """Retorna o ``Member`` do usuario logado, ou ``None`` se nao houver vinculo.

    ``member_profile`` e um OneToOne reverso: acessa-lo sem vinculo levanta
    ``RelatedObjectDoesNotExist``, e nao retorna ``None``.
    """
    return getattr(user, "member_profile", None)


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


class HasMemberProfile(BasePermission):
    """Exige que o usuario logado tenha um cadastro de membro vinculado.

    Usuarios de operacao (admin, tesouraria, secretaria) existem sem
    ``Member``: eles trabalham no painel web, nao no app. Sem esta checagem
    as telas de perfil/extrato/escala estouram 500 ao acessar
    ``user.member_profile``.
    """

    message = (
        "Seu usuario nao esta vinculado a um cadastro de membro. "
        "As telas do app sao exclusivas de membros; use o painel web."
    )

    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(user and user.is_authenticated and get_member_profile(user) is not None)
