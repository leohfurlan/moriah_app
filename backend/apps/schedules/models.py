from django.conf import settings
from django.db import models

from apps.accounts.models import Church, TimestampedModel


class Schedule(TimestampedModel):
    church = models.ForeignKey(Church, on_delete=models.CASCADE, related_name="schedules")
    event = models.ForeignKey("events.Event", on_delete=models.CASCADE, related_name="schedules")
    name = models.CharField(max_length=255)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="created_schedules")

    class Meta:
        verbose_name = "Escala"
        verbose_name_plural = "Escalas"

    def __str__(self) -> str:
        return f"{self.event} - {self.name}"


class ScheduleAssignment(TimestampedModel):
    class Status(models.TextChoices):
        PENDING = "pending", "Pendente"
        CONFIRMED = "confirmed", "Confirmado"
        DECLINED = "declined", "Recusado"

    church = models.ForeignKey(Church, on_delete=models.CASCADE, related_name="schedule_assignments")
    schedule = models.ForeignKey(Schedule, on_delete=models.CASCADE, related_name="assignments")
    member = models.ForeignKey("members.Member", on_delete=models.CASCADE, related_name="schedule_assignments")
    ministry_role = models.ForeignKey("ministries.MinistryRole", on_delete=models.PROTECT, related_name="schedule_assignments")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    justification = models.TextField(blank=True)
    responded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Escalado"
        verbose_name_plural = "Escalados"
        unique_together = ("schedule", "member", "ministry_role")

    def __str__(self) -> str:
        return f"{self.member} - {self.schedule}"


class ScheduleItem(TimestampedModel):
    """Item do repertorio / ordem do culto de uma escala.

    Extensao alem do PRD v1 (que previa apenas escala por funcao): a equipe
    escalada precisa saber **o que** sera executado, nao so quem toca o que.
    Um item pode ser uma musica (com tom e link da cifra) ou um momento da
    programacao — leitura, ministracao, aviso.
    """

    class ItemType(models.TextChoices):
        SONG = "song", "Musica"
        MOMENT = "moment", "Momento"
        READING = "reading", "Leitura"
        OTHER = "other", "Outro"

    church = models.ForeignKey(Church, on_delete=models.CASCADE, related_name="schedule_items")
    schedule = models.ForeignKey(Schedule, on_delete=models.CASCADE, related_name="items")
    order = models.PositiveIntegerField(default=1, help_text="Posicao na ordem do culto.")
    item_type = models.CharField(max_length=20, choices=ItemType.choices, default=ItemType.SONG)
    title = models.CharField(max_length=255)
    song_key = models.CharField("Tom", max_length=12, blank=True, help_text="Ex: G, Am, D#")
    reference_url = models.URLField("Link", blank=True, help_text="Cifra, letra ou video de referencia.")
    notes = models.TextField(blank=True)

    class Meta:
        verbose_name = "Item da Escala"
        verbose_name_plural = "Itens da Escala"
        # Ordem explicita primeiro; created_at desempata itens de mesma posicao.
        ordering = ["order", "created_at"]

    def __str__(self) -> str:
        return f"{self.order}. {self.title}"
