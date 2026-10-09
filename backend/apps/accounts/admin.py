from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import Church, User, UserRoleAssignment
from .scoped_admin import ChurchScopedAdmin


@admin.register(Church)
class ChurchAdmin(ChurchScopedAdmin):
    list_display = ("name", "city", "state", "active", "created_at")
    list_filter = ("active", "state")
    search_fields = ("name", "legal_name", "tax_id")


class UserRoleAssignmentInline(admin.TabularInline):
    model = UserRoleAssignment
    extra = 1


@admin.register(User)
class UserAdmin(ChurchScopedAdmin, BaseUserAdmin):
    list_display = ("email", "first_name", "last_name", "role", "church", "is_staff", "is_active")
    list_filter = ("role", "church", "is_staff", "is_active")
    search_fields = ("email", "first_name", "last_name", "username")
    ordering = ("email",)
    inlines = [UserRoleAssignmentInline]
    fieldsets = BaseUserAdmin.fieldsets + (
        ("Moriah", {"fields": ("church", "role", "phone")}),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ("Moriah", {"fields": ("email", "church", "role", "phone")}),
    )
