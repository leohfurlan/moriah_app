from django.contrib import admin

from .models import Schedule, ScheduleAssignment, ScheduleItem


class ScheduleAssignmentInline(admin.TabularInline):
    model = ScheduleAssignment
    extra = 0


class ScheduleItemInline(admin.TabularInline):
    """Repertorio/ordem do culto editado dentro da propria escala."""

    model = ScheduleItem
    extra = 3
    fields = ("order", "item_type", "title", "song_key", "reference_url", "notes")
    ordering = ("order",)


@admin.register(Schedule)
class ScheduleAdmin(admin.ModelAdmin):
    list_display = ("name", "event", "church", "created_by")
    list_filter = ("church", "event")
    search_fields = ("name", "event__name")
    autocomplete_fields = ("church", "event", "created_by")
    inlines = [ScheduleItemInline, ScheduleAssignmentInline]


@admin.register(ScheduleAssignment)
class ScheduleAssignmentAdmin(admin.ModelAdmin):
    list_display = ("schedule", "member", "ministry_role", "status", "responded_at")
    list_filter = ("church", "status", "ministry_role__ministry")
    search_fields = ("member__full_name", "schedule__name", "schedule__event__name")
    autocomplete_fields = ("church", "schedule", "member", "ministry_role")


@admin.register(ScheduleItem)
class ScheduleItemAdmin(admin.ModelAdmin):
    list_display = ("schedule", "order", "item_type", "title", "song_key")
    list_filter = ("church", "item_type", "schedule__event")
    search_fields = ("title", "schedule__name", "schedule__event__name")
    autocomplete_fields = ("church", "schedule")
