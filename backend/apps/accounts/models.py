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
