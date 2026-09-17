from django.contrib import admin
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from .models import Family, FamilyRelationship, Member, MemberLinkRequest, MemberUpdateRequest


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

@admin.register(MemberUpdateRequest)
class MemberUpdateRequestAdmin(admin.ModelAdmin):
    list_display = ("member", "status", "created_at", "reviewed_by", "reviewed_at")
    list_filter = ("church", "status", "created_at")
    search_fields = ("member__full_name", "member__email")
    readonly_fields = ("member", "church", "requested_changes", "created_at", "reviewed_by", "reviewed_at")


@admin.register(MemberLinkRequest)
class MemberLinkRequestAdmin(admin.ModelAdmin):
    list_display = ("user", "requested_email", "candidate_member", "status", "created_at")
    list_filter = ("church", "status", "created_at")
    search_fields = ("user__email", "requested_email", "candidate_member__full_name")
    readonly_fields = ("user", "church", "requested_email", "created_at", "updated_at")
    autocomplete_fields = ("candidate_member",)

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == "candidate_member" and getattr(request.user, "church_id", None):
            kwargs["queryset"] = Member.objects.filter(church_id=request.user.church_id, user__isnull=True)
        return super().formfield_for_foreignkey(db_field, request, **kwargs)

    @transaction.atomic
    def save_model(self, request, obj, form, change):
        if obj.status == MemberLinkRequest.Status.APPROVED:
            candidate = obj.candidate_member
            if candidate is None or candidate.church_id != obj.church_id:
                raise ValidationError("Aprovação exige um cadastro candidato da mesma igreja.")
            if candidate.user_id not in (None, obj.user_id):
                raise ValidationError("O cadastro candidato já está vinculado a outra conta.")
            candidate.user = obj.user
            candidate.save(update_fields=("user", "updated_at"))
            obj.reviewed_by = request.user
            obj.reviewed_at = timezone.now()
        elif obj.status == MemberLinkRequest.Status.REJECTED:
            obj.reviewed_by = request.user
            obj.reviewed_at = timezone.now()
        super().save_model(request, obj, form, change)
