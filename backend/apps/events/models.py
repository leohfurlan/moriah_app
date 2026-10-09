from django.conf import settings
from django.db import models
from django.db.models import Q

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


class ServiceTime(TimestampedModel):
    church = models.ForeignKey(Church, on_delete=models.CASCADE, related_name="service_times")
    weekday = models.PositiveSmallIntegerField(choices=enumerate(("Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo")))
    time = models.TimeField()
    location = models.CharField(max_length=255)
    active = models.BooleanField(default=True)

    class Meta:
        ordering = ("weekday", "time", "id")
        constraints = [
            models.CheckConstraint(condition=Q(weekday__gte=0, weekday__lte=6), name="service_weekday_valid"),
            models.UniqueConstraint(fields=("church", "weekday", "time", "location"), name="unique_service_time"),
        ]


def event_announcement_path(instance: "EventAnnouncement", filename: str) -> str:
    return f"event-announcements/{instance.church_id}/{instance.event_id}/{filename}"


class EventAnnouncement(TimestampedModel):
    """Folder visual de um evento exibido no carrossel da Home."""

    church = models.ForeignKey(Church, on_delete=models.CASCADE, related_name="event_announcements")
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="announcements")
    title = models.CharField(max_length=255, blank=True)
    image = models.FileField(upload_to=event_announcement_path)
    position = models.PositiveSmallIntegerField(default=1)
    active = models.BooleanField(default=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="created_event_announcements")

    class Meta:
        verbose_name = "Aviso do carrossel"
        verbose_name_plural = "Avisos do carrossel"
        ordering = ["position", "created_at"]
        constraints = [
            models.CheckConstraint(condition=Q(position__gte=1, position__lte=4), name="event_announcement_position_1_4"),
            models.UniqueConstraint(fields=("church", "position"), condition=Q(active=True), name="active_event_announcement_position_unique"),
        ]

    def __str__(self) -> str:
        return self.title or f"{self.event} · posição {self.position}"
