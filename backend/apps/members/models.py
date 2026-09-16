from django.conf import settings
from django.db import models

from apps.accounts.models import Church, TimestampedModel


class Family(TimestampedModel):
    church = models.ForeignKey(Church, on_delete=models.CASCADE, related_name="families")
    name = models.CharField(max_length=255)
    notes = models.TextField(blank=True)

    class Meta:
        verbose_name = "Familia"
        verbose_name_plural = "Familias"

    def __str__(self) -> str:
        return self.name


class Member(TimestampedModel):
    class Status(models.TextChoices):
        ACTIVE = "active", "Ativo"
        VISITOR = "visitor", "Visitante"
        INACTIVE = "inactive", "Inativo"
        TRANSFERRED = "transferred", "Transferido"
        DECEASED = "deceased", "Falecido"

    church = models.ForeignKey(Church, on_delete=models.CASCADE, related_name="members")
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="member_profile")
    family = models.ForeignKey("members.Family", on_delete=models.SET_NULL, null=True, blank=True, related_name="members")
    cell = models.ForeignKey("cells.Cell", on_delete=models.SET_NULL, null=True, blank=True, related_name="members")
    full_name = models.CharField(max_length=255)
    preferred_name = models.CharField(max_length=120, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=30, blank=True)
    birth_date = models.DateField(null=True, blank=True)
    address = models.TextField(blank=True)
    marital_status = models.CharField(max_length=50, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    joined_at = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        verbose_name = "Membro"
        verbose_name_plural = "Membros"

    def __str__(self) -> str:
        return self.full_name


class MemberUpdateRequest(TimestampedModel):
    class Status(models.TextChoices):
        PENDING = "pending", "Pendente"
        APPROVED = "approved", "Aprovada"
        REJECTED = "rejected", "Rejeitada"

    church = models.ForeignKey(Church, on_delete=models.CASCADE, related_name="member_update_requests")
    member = models.ForeignKey(Member, on_delete=models.CASCADE, related_name="update_requests")
    requested_changes = models.JSONField(default=dict)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    review_notes = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_member_update_requests",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Solicitacao de alteracao cadastral"
        verbose_name_plural = "Solicitacoes de alteracao cadastral"
        ordering = ["-created_at"]

class FamilyRelationship(TimestampedModel):
    class RelationshipType(models.TextChoices):
        SPOUSE = "spouse", "Conjuge"
        CHILD = "child", "Filho(a)"
        PARENT = "parent", "Pai/Mae"
        GUARDIAN = "guardian", "Responsavel"
        SIBLING = "sibling", "Irmao(a)"
        OTHER = "other", "Outro"

    church = models.ForeignKey(Church, on_delete=models.CASCADE, related_name="family_relationships")
    family = models.ForeignKey(Family, on_delete=models.CASCADE, related_name="relationships")
    member = models.ForeignKey(Member, on_delete=models.CASCADE, related_name="family_relationships")
    related_member = models.ForeignKey(Member, on_delete=models.CASCADE, related_name="related_to")
    relationship_type = models.CharField(max_length=20, choices=RelationshipType.choices)

    class Meta:
        verbose_name = "Relacionamento Familiar"
        verbose_name_plural = "Relacionamentos Familiares"
        unique_together = ("family", "member", "related_member", "relationship_type")

    def __str__(self) -> str:
        return f"{self.member} - {self.get_relationship_type_display()} - {self.related_member}"
