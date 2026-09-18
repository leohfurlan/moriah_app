from django.conf import settings
from django.db import models

from apps.accounts.models import Church, TimestampedModel


class Content(TimestampedModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Rascunho"
        PUBLISHED = "published", "Publicado"

    church = models.ForeignKey(Church, on_delete=models.CASCADE, related_name="contents")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="authored_contents")
    title = models.CharField(max_length=255)
    summary = models.CharField(max_length=500, blank=True)
    body = models.TextField()
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.DRAFT)
    published_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Conteúdo"
        verbose_name_plural = "Conteúdos"
        ordering = ["-published_at", "-created_at"]
        indexes = [models.Index(fields=("church", "status"))]

    def __str__(self) -> str:
        return self.title
