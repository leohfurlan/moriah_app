from django.contrib import admin

from .models import Cell, CellAttendance, CellMeeting


class CellAttendanceInline(admin.TabularInline):
    model = CellAttendance
    extra = 0


@admin.register(Cell)
class CellAdmin(admin.ModelAdmin):
    list_display = ("name", "church", "leader", "meeting_day", "location")
    list_filter = ("church", "meeting_day")
    search_fields = ("name", "location")
    autocomplete_fields = ("church", "leader", "assistant_leader")


@admin.register(CellMeeting)
class CellMeetingAdmin(admin.ModelAdmin):
    list_display = ("cell", "date", "visitors_count", "created_by")
    list_filter = ("church", "date", "cell")
    search_fields = ("cell__name", "notes")
    autocomplete_fields = ("church", "cell", "created_by")
    inlines = [CellAttendanceInline]


@admin.register(CellAttendance)
class CellAttendanceAdmin(admin.ModelAdmin):
    list_display = ("meeting", "member", "present")
    list_filter = ("church", "present")
    autocomplete_fields = ("meeting", "member")
