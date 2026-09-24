from django.conf import settings
from django.db import models

from apps.accounts.models import Church, TimestampedModel


class AuditLog(TimestampedModel):
    church = models.ForeignKey(Church, on_delete=models.CASCADE, related_name="audit_logs", null=True, blank=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="audit_logs")
    action = models.CharField(max_length=120)
    model_name = models.CharField(max_length=120)
    object_id = models.CharField(max_length=64)
    payload = models.JSONField(default=dict, blank=True)

    class Meta:
        verbose_name = "Log de Auditoria"
        verbose_name_plural = "Logs de Auditoria"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.action} - {self.model_name} - {self.object_id}"


class Notification(TimestampedModel):
    """Aviso persistente, sempre pertencente a uma igreja e destinatario."""

    church = models.ForeignKey(Church, on_delete=models.CASCADE, related_name="notifications")
    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    category = models.CharField(max_length=40)
    title = models.CharField(max_length=255)
    body = models.TextField()
    detail = models.TextField(blank=True)
    action_label = models.CharField(max_length=120, blank=True)
    action_route = models.CharField(max_length=255, blank=True)
    dedupe_key = models.CharField(max_length=160, unique=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=("recipient", "read_at", "-created_at"), name="audit_notif_recipie_8d5dc3_idx"),
            models.Index(fields=("church", "-created_at"), name="audit_notif_church_4ee1de_idx"),
        ]

    @property
    def is_read(self):
        return self.read_at is not None
