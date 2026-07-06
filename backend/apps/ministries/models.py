from django.db import models

from apps.accounts.models import Church, TimestampedModel


class Ministry(TimestampedModel):
    church = models.ForeignKey(Church, on_delete=models.CASCADE, related_name="ministries")
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    members = models.ManyToManyField("members.Member", related_name="ministries", blank=True)

    class Meta:
        verbose_name = "Ministerio"
        verbose_name_plural = "Ministerios"

    def __str__(self) -> str:
        return self.name


class MinistryRole(TimestampedModel):
    church = models.ForeignKey(Church, on_delete=models.CASCADE, related_name="ministry_roles")
    ministry = models.ForeignKey(Ministry, on_delete=models.CASCADE, related_name="roles")
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    class Meta:
        verbose_name = "Funcao Ministerial"
        verbose_name_plural = "Funcoes Ministeriais"
        unique_together = ("ministry", "name")

    def __str__(self) -> str:
        return f"{self.ministry} - {self.name}"
