from django.conf import settings
from django.db import models

from apps.accounts.models import Church, TimestampedModel


def contribution_attachment_path(instance: "ContributionAttachment", filename: str) -> str:
    return f"contributions/{instance.contribution_id}/{filename}"


class Contribution(TimestampedModel):
    class Category(models.TextChoices):
        TITHE = "tithe", "Dizimo"
        OFFERING = "offering", "Oferta"
        CAMPAIGN = "campaign", "Campanha"
        MISSIONS = "missions", "Missoes"
        EVENT = "event", "Evento"
        OTHER = "other", "Outros"

    class Status(models.TextChoices):
        PENDING = "pending", "Pendente"
        APPROVED = "approved", "Aprovada"
        REJECTED = "rejected", "Rejeitada"
        NEEDS_REVIEW = "needs_review", "Precisa Revisao"

    church = models.ForeignKey(Church, on_delete=models.CASCADE, related_name="contributions")
    member = models.ForeignKey("members.Member", on_delete=models.CASCADE, related_name="contributions")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="created_contributions")
    category = models.CharField(max_length=20, choices=Category.choices)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    contribution_date = models.DateField()
    notes = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="reviewed_contributions")
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Contribuicao"
        verbose_name_plural = "Contribuicoes"
        ordering = ["-contribution_date", "-created_at"]

    def __str__(self) -> str:
        return f"{self.member} - {self.amount}"


class ContributionAttachment(TimestampedModel):
    contribution = models.ForeignKey(Contribution, on_delete=models.CASCADE, related_name="attachments")
    file = models.FileField(upload_to=contribution_attachment_path)
    original_name = models.CharField(max_length=255, blank=True)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="uploaded_contribution_attachments")

    class Meta:
        verbose_name = "Anexo de Contribuicao"
        verbose_name_plural = "Anexos de Contribuicao"

    def __str__(self) -> str:
        return self.original_name or self.file.name
