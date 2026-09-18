from django.contrib import admin

from .models import Event, EventAnnouncement


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ("name", "church", "event_type", "start_at", "location", "active")
    list_filter = ("church", "event_type", "active")
    search_fields = ("name", "location")


@admin.register(EventAnnouncement)
class EventAnnouncementAdmin(admin.ModelAdmin):
    list_display = ("title", "event", "church", "position", "active", "updated_at")
    list_filter = ("church", "active", "position")
    search_fields = ("title", "event__name")
