from django.contrib import admin

from .models import Family, FamilyRelationship, Member


class FamilyRelationshipInline(admin.TabularInline):
    model = FamilyRelationship
    fk_name = "family"
    extra = 0


@admin.register(Family)
class FamilyAdmin(admin.ModelAdmin):
    list_display = ("name", "church", "created_at")
    search_fields = ("name",)
    list_filter = ("church",)
    inlines = [FamilyRelationshipInline]


@admin.register(Member)
class MemberAdmin(admin.ModelAdmin):
    list_display = ("full_name", "church", "status", "cell", "user")
    list_filter = ("church", "status", "cell")
    search_fields = ("full_name", "preferred_name", "email", "phone")
    autocomplete_fields = ("church", "family", "cell", "user")


@admin.register(FamilyRelationship)
class FamilyRelationshipAdmin(admin.ModelAdmin):
    list_display = ("family", "member", "relationship_type", "related_member")
    list_filter = ("church", "relationship_type")
    autocomplete_fields = ("family", "member", "related_member")
