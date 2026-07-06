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
