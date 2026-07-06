from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import Church, User


@admin.register(Church)
class ChurchAdmin(admin.ModelAdmin):
    list_display = ("name", "city", "state", "active", "created_at")
    list_filter = ("active", "state")
    search_fields = ("name", "legal_name", "tax_id")


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ("email", "first_name", "last_name", "role", "church", "is_staff", "is_active")
    list_filter = ("role", "church", "is_staff", "is_active")
    search_fields = ("email", "first_name", "last_name", "username")
    ordering = ("email",)
    fieldsets = BaseUserAdmin.fieldsets + (
        ("Moriah", {"fields": ("church", "role", "phone")}),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ("Moriah", {"fields": ("email", "church", "role", "phone")}),
    )
