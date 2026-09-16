from django.db import models

from apps.accounts.models import Church, TimestampedModel


class Event(TimestampedModel):
    class EventType(models.TextChoices):
        SERVICE = "culto", "Culto"
        CELL = "celula", "Celula"
        REHEARSAL = "ensaio", "Ensaio"
        MEETING = "reuniao", "Reuniao"
        CONFERENCE = "conferencia", "Conferencia"
        SPECIAL = "especial", "Evento especial"

    church = models.ForeignKey(Church, on_delete=models.CASCADE, related_name="events")
    name = models.CharField(max_length=255)
    event_type = models.CharField(max_length=100, choices=EventType.choices, blank=True)
    start_at = models.DateTimeField()
    end_at = models.DateTimeField(null=True, blank=True)
    location = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True)
    active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Evento"
        verbose_name_plural = "Eventos"
        ordering = ["start_at"]

    def __str__(self) -> str:
        return self.name