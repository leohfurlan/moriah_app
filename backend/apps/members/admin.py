from django.contrib import admin

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


from django import forms
from django.contrib import messages
from django.http import HttpResponseRedirect
from rest_framework.exceptions import APIException
from .linking import can_review, review_request, validate_decision


class MemberLinkReviewForm(forms.ModelForm):
    class Meta:
        model = MemberLinkRequest
        fields = "__all__"

    def clean(self):
        data = super().clean()
        if self.instance.pk and data.get("status") in {"approved", "rejected"}:
            original = MemberLinkRequest.objects.get(pk=self.instance.pk)
            try:
                validate_decision(self.actor, original, data["status"], data.get("candidate_member"), data.get("review_notes", ""))
            except APIException as error:
                raise forms.ValidationError(str(error.detail))
        elif self.instance.pk and MemberLinkRequest.objects.get(pk=self.instance.pk).status != "pending":
            raise forms.ValidationError("Não é possível reabrir uma solicitação já revisada.")
        return data


@admin.register(MemberLinkRequest)
class MemberLinkRequestAdmin(admin.ModelAdmin):
    form = MemberLinkReviewForm
    list_display = ("user", "requested_email", "candidate_member", "status", "created_at")
    list_filter = ("status", "created_at")
    search_fields = ("user__email", "requested_email", "candidate_member__full_name")
    readonly_fields = ("user", "church", "requested_email", "created_at", "updated_at", "reviewed_by", "reviewed_at")

    def get_queryset(self, request):
        return super().get_queryset(request).filter(church_id=request.user.church_id)

    def changeform_view(self, request, object_id=None, form_url="", extra_context=None):
        try:
            return super().changeform_view(request, object_id, form_url, extra_context)
        except APIException as error:
            # A competing review can invalidate a form after clean(); Django's
            # transaction has rolled back before returning the fresh detail.
            self.message_user(request, str(error.detail), level=messages.ERROR)
            return HttpResponseRedirect(request.path)

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def has_view_permission(self, request, obj=None):
        return can_review(request.user) and (obj is None or obj.church_id == request.user.church_id)

    def has_change_permission(self, request, obj=None):
        return self.has_view_permission(request, obj)

    def get_form(self, request, obj=None, **kwargs):
        base = super().get_form(request, obj, **kwargs)
        class ActorForm(base):
            actor = request.user
        return ActorForm

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == "candidate_member":
            kwargs["queryset"] = Member.objects.filter(church_id=request.user.church_id)
        return super().formfield_for_foreignkey(db_field, request, **kwargs)

    def save_model(self, request, obj, form, change):
        if obj.status in {"approved", "rejected"}:
            updated = review_request(request.user, obj.pk, obj.status, obj.candidate_member_id, obj.review_notes)
            obj.__dict__.update(updated.__dict__)
        else:
            # Pending requests cannot silently change candidate/notes through admin.
            obj.refresh_from_db()
