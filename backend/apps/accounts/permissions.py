from rest_framework.permissions import BasePermission

from .models import User


def get_member_profile(user):
    """Retorna o ``Member`` do usuario logado, ou ``None`` se nao houver vinculo.

    ``member_profile`` e um OneToOne reverso: acessa-lo sem vinculo levanta
    ``RelatedObjectDoesNotExist``, e nao retorna ``None``.
    """
    return getattr(user, "member_profile", None)


def is_admin_user(user) -> bool:
    return bool(
        user
        and user.is_authenticated
        and (user.is_superuser or user.has_role(User.Role.ADMIN))
    )


class IsTreasurerOrAdmin(BasePermission):
    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (user.is_superuser or user.has_role(User.Role.ADMIN, User.Role.TREASURER))
        )


class IsFinancialManager(BasePermission):
    """Acesso ao livro financeiro administrativo da igreja."""

    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (
                user.is_superuser
                or user.has_role(User.Role.ADMIN, User.Role.PASTOR, User.Role.TREASURER)
            )
        )


class IsCellLeaderOrAdmin(BasePermission):
    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (user.is_superuser or user.has_role(User.Role.ADMIN, User.Role.CELL_LEADER))
        )


class IsMinistryOrCellLeader(BasePermission):
    """Cria compromisso na agenda: lideranca de ministerio (coordenacao) ou de celula.

    Decisao de produto: compromisso nao e para qualquer membro — quem organiza
    agenda e a lideranca. Criar e editar exige tambem vinculo de membro
    (`HasMemberProfile`), porque o compromisso pertence ao cadastro do membro.
    """

    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (
                user.is_superuser
                or user.has_role(
                    User.Role.ADMIN,
                    User.Role.PASTOR,
                    User.Role.COORDINATOR,
                    User.Role.CELL_LEADER,
                )
            )
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
        "As areas pessoais exigem um membro associado a esta conta."
    )

    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(user and user.is_authenticated and get_member_profile(user) is not None)


class HasMemberProfileOrAdmin(HasMemberProfile):
    """Permite leitura administrativa sem transformar admin em membro."""

    def has_permission(self, request, view) -> bool:
        return super().has_permission(request, view) or is_admin_user(request.user)

class IsScheduleCoordinatorOrAdmin(BasePermission):
    """Permite operar escalas a lideranca e coordenadores autenticados."""

    message = (
        "Apenas coordenadores de escala e a lideranca podem criar ou publicar escalas. "
        "Fale com a secretaria se precisar de acesso."
    )

    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (
                user.is_superuser
                or user.has_role(User.Role.ADMIN, User.Role.PASTOR, User.Role.COORDINATOR)
            )
        )


class IsEventManager(BasePermission):
    """Permite administrar eventos e os folders do carrossel."""

    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (user.is_superuser or user.has_role(User.Role.ADMIN, User.Role.PASTOR, User.Role.COORDINATOR))
        )


class IsMemberDirectoryUser(BasePermission):
    """Permite consultar a membresia administrativa da propria igreja."""

    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (
                user.is_superuser
                or user.has_role(
                    User.Role.ADMIN,
                    User.Role.PASTOR,
                    User.Role.SECRETARY,
                    User.Role.TREASURER,
                    User.Role.COORDINATOR,
                )
            )
        )


def user_capabilities(user) -> list[str]:
    """Expõe capacidades de produto sem transformar superuser em membro."""
    capabilities: set[str] = set()
    if get_member_profile(user) is not None:
        capabilities.add("member")
    if user.is_superuser or user.has_role(User.Role.ADMIN):
        capabilities.add("manage_all")
    if user.has_role(User.Role.PASTOR):
        capabilities.add("manage_pastoral")
    if user.has_role(User.Role.SECRETARY):
        capabilities.add("manage_members")
    if user.has_role(User.Role.TREASURER):
        capabilities.add("review_contributions")
    if user.is_superuser or user.has_role(User.Role.ADMIN, User.Role.PASTOR, User.Role.TREASURER):
        capabilities.add("manage_finance")
    if user.is_superuser or user.has_role(User.Role.ADMIN, User.Role.PASTOR):
        capabilities.add("manage_content")
    if user.is_superuser or user.has_role(User.Role.ADMIN, User.Role.PASTOR, User.Role.COORDINATOR):
        capabilities.add("manage_events")
    # Mesma regra de `IsScheduleCoordinatorOrAdmin`: quem o backend autoriza a
    # operar escalas recebe a capacidade, para o cliente nao adivinhar.
    if user.is_superuser or user.has_role(
        User.Role.ADMIN, User.Role.PASTOR, User.Role.COORDINATOR
    ):
        capabilities.add("manage_schedules")
    if user.has_role(User.Role.CELL_LEADER):
        capabilities.add("manage_cells")
    if user.church_id:
        member = get_member_profile(user)
        publisher = user.is_superuser or user.has_role(User.Role.ADMIN, User.Role.PASTOR)
        if publisher:
            capabilities.add("manage_content")
        if publisher or (member and member.church_id == user.church_id):
            capabilities.add("read_content")
    return sorted(capabilities)


def can_access_management(user) -> bool:
    """Contas que operam o painel de gestao (mesmo sem vinculo de membro).

    O conjunto precisa acompanhar `user_capabilities`: quem recebe uma
    capacidade de gestao (ex.: `manage_finance` do tesoureiro, `manage_content`
    do pastor) tambem opera o painel, senao o item de menu e a tela existem no
    backend mas o app nao oferece o caminho (relatorio §5.3).
    """
    return bool(set(user_capabilities(user)).intersection(
        {
            "manage_all",
            "manage_pastoral",
            "manage_members",
            "manage_finance",
            "manage_content",
            "review_contributions",
            "manage_schedules",
            "manage_cells",
            "manage_events",
        }
    ))
