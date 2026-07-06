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
