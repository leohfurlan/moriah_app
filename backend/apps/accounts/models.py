from django.contrib.auth.models import AbstractUser
from django.db import models


class TimestampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Church(TimestampedModel):
    name = models.CharField(max_length=255)
    legal_name = models.CharField(max_length=255, blank=True)
    tax_id = models.CharField(max_length=18, blank=True)
    city = models.CharField(max_length=120, blank=True)
    state = models.CharField(max_length=2, blank=True)
    active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Igreja"
        verbose_name_plural = "Igrejas"

    def __str__(self) -> str:
        return self.name


class User(AbstractUser, TimestampedModel):
    class Role(models.TextChoices):
        ADMIN = "admin", "Admin"
        PASTOR = "pastor", "Pastor"
        SECRETARY = "secretary", "Secretaria"
        TREASURER = "treasurer", "Tesoureiro"
        CELL_LEADER = "cell_leader", "Lider de Celula"
        COORDINATOR = "coordinator", "Coordenador"
        MEMBER = "member", "Membro"

    email = models.EmailField(unique=True)
    church = models.ForeignKey(Church, on_delete=models.PROTECT, related_name="users", null=True, blank=True)
    role = models.CharField(max_length=32, choices=Role.choices, default=Role.MEMBER)
    phone = models.CharField(max_length=30, blank=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    class Meta:
        verbose_name = "Usuario"
        verbose_name_plural = "Usuarios"

    def __str__(self) -> str:
        return self.get_full_name() or self.email

    def assigned_roles(self) -> frozenset[str]:
        """Retorna o papel principal e os papéis adicionais da conta.

        ``role`` permanece como campo principal para compatibilidade com os
        dados existentes. Novos papéis compostos ficam em
        ``UserRoleAssignment`` e nunca alteram a existencia do member_profile.
        """
        roles = {self.role} if self.role else set()
        if self.pk:
            roles.update(self.role_assignments.values_list("role", flat=True))
        return frozenset(roles)

    def has_role(self, *roles: str) -> bool:
        return bool(self.assigned_roles().intersection(roles))

    def add_role(self, role: str):
        """Adiciona um papel sem substituir o papel principal da conta."""
        valid_roles = {value for value, _label in self.Role.choices}
        if role not in valid_roles:
            raise ValueError(f"Papel invalido: {role}")
        if role == self.role:
            return None
        return UserRoleAssignment.objects.get_or_create(user=self, role=role)


class UserRoleAssignment(TimestampedModel):
    """Papel adicional de uma conta, permitindo combinar capacidades."""

    user = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="role_assignments")
    role = models.CharField(max_length=32, choices=User.Role.choices)

    class Meta:
        verbose_name = "Papel adicional"
        verbose_name_plural = "Papeis adicionais"
        constraints = [
            models.UniqueConstraint(fields=("user", "role"), name="unique_user_role_assignment"),
        ]

    def __str__(self) -> str:
        return f"{self.user} - {self.get_role_display()}"
