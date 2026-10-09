from django.contrib import admin
from apps.accounts.scoped_admin import ChurchScopedAdmin

from .models import Ministry, MinistryRole


@admin.register(Ministry)
class MinistryAdmin(ChurchScopedAdmin):
    list_display = ("name", "church")
    list_filter = ("church",)
    search_fields = ("name",)
    filter_horizontal = ("members", "coordinators")


@admin.register(MinistryRole)
class MinistryRoleAdmin(admin.ModelAdmin):
    list_display = ("name", "ministry", "church")
    list_filter = ("church", "ministry")
    search_fields = ("name", "ministry__name")
