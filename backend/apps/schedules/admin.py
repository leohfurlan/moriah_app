from django.contrib import admin

from .models import Schedule, ScheduleAssignment


class ScheduleAssignmentInline(admin.TabularInline):
    model = ScheduleAssignment
    extra = 0


@admin.register(Schedule)
class ScheduleAdmin(admin.ModelAdmin):
    list_display = ("name", "event", "church", "created_by")
    list_filter = ("church", "event")
    search_fields = ("name", "event__name")
    autocomplete_fields = ("church", "event", "created_by")
    inlines = [ScheduleAssignmentInline]


@admin.register(ScheduleAssignment)
class ScheduleAssignmentAdmin(admin.ModelAdmin):
    list_display = ("schedule", "member", "ministry_role", "status", "responded_at")
    list_filter = ("church", "status", "ministry_role__ministry")
    search_fields = ("member__full_name", "schedule__name", "schedule__event__name")
    autocomplete_fields = ("church", "schedule", "member", "ministry_role")
