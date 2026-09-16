from django.contrib import admin

from .models import PersonalCommitment, Schedule, ScheduleAssignment, ScheduleItem, Song, WorshipTeam, WorshipTeamMember


class ScheduleAssignmentInline(admin.TabularInline):
    model = ScheduleAssignment
    extra = 0


class ScheduleItemInline(admin.TabularInline):
    model = ScheduleItem
    extra = 3
    fields = ("order", "item_type", "song", "title", "song_key", "bpm", "duration_seconds", "reference_url", "notes")
    ordering = ("order",)


@admin.register(Schedule)
class ScheduleAdmin(admin.ModelAdmin):
    list_display = ("name", "event", "church", "status", "worship_team", "published_at")
    list_filter = ("church", "status", "event")
    search_fields = ("name", "event__name")
    autocomplete_fields = ("church", "event", "created_by", "worship_team")
    inlines = [ScheduleItemInline, ScheduleAssignmentInline]


@admin.register(ScheduleAssignment)
class ScheduleAssignmentAdmin(admin.ModelAdmin):
    list_display = ("schedule", "member", "ministry_role", "status", "substitution_for", "responded_at")
    list_filter = ("church", "status", "ministry_role__ministry")
    search_fields = ("member__full_name", "schedule__name", "schedule__event__name")
    autocomplete_fields = ("church", "schedule", "member", "ministry_role", "substitution_for")


@admin.register(ScheduleItem)
class ScheduleItemAdmin(admin.ModelAdmin):
    list_display = ("schedule", "order", "item_type", "title", "song", "song_key", "bpm")
    list_filter = ("church", "item_type", "schedule__event")
    search_fields = ("title", "song__title", "schedule__name", "schedule__event__name")
    autocomplete_fields = ("church", "schedule", "song")


@admin.register(Song)
class SongAdmin(admin.ModelAdmin):
    list_display = ("title", "artist", "default_key", "bpm", "active", "church")
    list_filter = ("church", "active")
    search_fields = ("title", "artist", "tags")
    autocomplete_fields = ("church",)


@admin.register(WorshipTeam)
class WorshipTeamAdmin(admin.ModelAdmin):
    list_display = ("name", "church", "active")
    list_filter = ("church", "active")
    search_fields = ("name",)
    autocomplete_fields = ("church",)


@admin.register(WorshipTeamMember)
class WorshipTeamMemberAdmin(admin.ModelAdmin):
    list_display = ("team", "member", "role", "active", "church")
    list_filter = ("church", "team", "active")
    search_fields = ("team__name", "member__full_name", "role")
    autocomplete_fields = ("church", "team", "member")


@admin.register(PersonalCommitment)
class PersonalCommitmentAdmin(admin.ModelAdmin):
    list_display = ("title", "member", "commitment_type", "starts_at", "status", "church")
    list_filter = ("church", "commitment_type", "status")
    search_fields = ("title", "member__full_name")
    autocomplete_fields = ("church", "member")