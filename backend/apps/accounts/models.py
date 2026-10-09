import uuid

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


class WhatsAppIdentity(TimestampedModel):
    """Verified login identity; contact fields alone never grant access."""
    church = models.ForeignKey(Church, on_delete=models.CASCADE)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="whatsapp_identity")
    phone = models.CharField(max_length=16)

    class Meta:
        constraints = [models.UniqueConstraint(fields=("church", "phone"), name="unique_church_whatsapp")]


class WhatsAppChallenge(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    church = models.ForeignKey(Church, on_delete=models.CASCADE)
    phone = models.CharField(max_length=16)
    purpose = models.CharField(max_length=8, default="login")
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True)
    code_digest = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    sent = models.BooleanField(default=False)
    attempts = models.PositiveSmallIntegerField(default=0)
    verified_at = models.DateTimeField(null=True)
    consumed_at = models.DateTimeField(null=True)
    proof_digest = models.CharField(max_length=64, blank=True)
    proof_expires_at = models.DateTimeField(null=True)


class WhatsAppSendLimit(models.Model):
    """Database locks share rate limits across workers, without Redis."""
    key = models.CharField(max_length=64, primary_key=True)
    window_started = models.DateTimeField()
    last_sent = models.DateTimeField(null=True)
    count = models.PositiveIntegerField(default=0)
