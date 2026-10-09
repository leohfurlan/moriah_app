from decimal import Decimal

from django.conf import settings
from django.db import models
from django.core.validators import MinValueValidator

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
    review_notes = models.TextField(blank=True)
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


class FinancialEntry(TimestampedModel):
    """Lançamento administrativo de entrada, saída ou vencimento futuro."""

    class EntryType(models.TextChoices):
        INCOME = "income", "Entrada"
        EXPENSE = "expense", "Saída"

    class Category(models.TextChoices):
        OFFERING = "offering", "Oferta"
        TITHE = "tithe", "Dízimo"
        CAMPAIGN = "campaign", "Campanha"
        MISSIONS = "missions", "Missões"
        EVENT = "event", "Evento"
        DONATION = "donation", "Doação"
        UTILITIES = "utilities", "Contas e serviços"
        CARD = "card", "Cartão"
        PAYROLL = "payroll", "Pessoal"
        OTHER = "other", "Outros"

    class Status(models.TextChoices):
        SCHEDULED = "scheduled", "Agendado"
        PAID = "paid", "Pago"
        CANCELLED = "cancelled", "Cancelado"

    class Source(models.TextChoices):
        MANUAL = "manual", "Lançamento manual"
        OFFER_ACCEPTANCE = "offer_acceptance", "Aceite de oferta"
        EVENT_PAYMENT = "event_payment", "Inscrição de evento"
        CONTRIBUTION = "contribution", "Contribuição"

    church = models.ForeignKey(Church, on_delete=models.CASCADE, related_name="financial_entries")
    contribution = models.OneToOneField(
        Contribution,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="financial_entry",
    )
    entry_type = models.CharField(max_length=12, choices=EntryType.choices)
    category = models.CharField(max_length=20, choices=Category.choices, default=Category.OTHER)
    source = models.CharField(max_length=24, choices=Source.choices, default=Source.MANUAL)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.SCHEDULED)
    description = models.CharField(max_length=255)
    amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))])
    due_date = models.DateField()
    paid_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)
    member = models.ForeignKey("members.Member", on_delete=models.SET_NULL, null=True, blank=True, related_name="financial_entries")
    event = models.ForeignKey("events.Event", on_delete=models.SET_NULL, null=True, blank=True, related_name="financial_entries")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="created_financial_entries")

    class Meta:
        verbose_name = "Lançamento financeiro"
        verbose_name_plural = "Lançamentos financeiros"
        ordering = ["due_date", "-created_at"]
        indexes = [
            models.Index(fields=("church", "due_date")),
            models.Index(fields=("church", "status")),
        ]

    def __str__(self) -> str:
        return f"{self.description} - {self.amount}"
