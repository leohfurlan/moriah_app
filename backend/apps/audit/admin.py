from django.contrib import admin

from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "action", "model_name", "object_id", "user", "church")
    list_filter = ("action", "model_name", "church")
    search_fields = ("object_id", "model_name", "action")
