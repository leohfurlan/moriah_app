from django.conf import settings
from django.db import models
from apps.accounts.models import TimestampedModel


class Content(TimestampedModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Rascunho"
        PUBLISHED = "published", "Publicado"

    church = models.ForeignKey("accounts.Church", on_delete=models.CASCADE, related_name="contents")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    title = models.CharField(max_length=255)
    summary = models.CharField(max_length=500, blank=True)
    body = models.TextField()
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    published_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["church", "status", "-created_at"], name="content_church_status_idx")]
