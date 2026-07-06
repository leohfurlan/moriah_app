from django.conf import settings
from django.db import models

from apps.accounts.models import Church, TimestampedModel


class Cell(TimestampedModel):
    church = models.ForeignKey(Church, on_delete=models.CASCADE, related_name="cells")
    name = models.CharField(max_length=255)
    leader = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="led_cells")
    assistant_leader = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="assisted_cells")
    meeting_day = models.CharField(max_length=40, blank=True)
    meeting_time = models.TimeField(null=True, blank=True)
    location = models.CharField(max_length=255, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        verbose_name = "Celula"
        verbose_name_plural = "Celulas"

    def __str__(self) -> str:
        return self.name


class CellMeeting(TimestampedModel):
    church = models.ForeignKey(Church, on_delete=models.CASCADE, related_name="cell_meetings")
    cell = models.ForeignKey(Cell, on_delete=models.CASCADE, related_name="meetings")
    date = models.DateField()
    notes = models.TextField(blank=True)
    visitors_count = models.PositiveIntegerField(default=0)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="cell_meetings_created")

    class Meta:
        verbose_name = "Reuniao de Celula"
        verbose_name_plural = "Reunioes de Celula"
        ordering = ["-date", "-created_at"]

    def __str__(self) -> str:
        return f"{self.cell} - {self.date}"


class CellAttendance(TimestampedModel):
    church = models.ForeignKey(Church, on_delete=models.CASCADE, related_name="cell_attendances")
    meeting = models.ForeignKey(CellMeeting, on_delete=models.CASCADE, related_name="attendances")
    member = models.ForeignKey("members.Member", on_delete=models.CASCADE, related_name="cell_attendances")
    present = models.BooleanField(default=True)
    note = models.CharField(max_length=255, blank=True)

    class Meta:
        verbose_name = "Presenca de Celula"
        verbose_name_plural = "Presencas de Celula"
        unique_together = ("meeting", "member")

    def __str__(self) -> str:
        return f"{self.member} - {self.meeting}"
