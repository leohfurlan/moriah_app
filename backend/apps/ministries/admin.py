from django.contrib import admin

from .models import Ministry, MinistryRole


@admin.register(Ministry)
class MinistryAdmin(admin.ModelAdmin):
    list_display = ("name", "church")
    list_filter = ("church",)
    search_fields = ("name",)
    filter_horizontal = ("members",)


@admin.register(MinistryRole)
class MinistryRoleAdmin(admin.ModelAdmin):
    list_display = ("name", "ministry", "church")
    list_filter = ("church", "ministry")
    search_fields = ("name", "ministry__name")
