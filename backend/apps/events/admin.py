from django.contrib import admin

from .models import Event


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ("name", "church", "event_type", "start_at", "location", "active")
    list_filter = ("church", "event_type", "active")
    search_fields = ("name", "location")
