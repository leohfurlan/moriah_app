from django.contrib import admin
from django.utils.html import format_html

from .models import Contribution, ContributionAttachment, FinancialEntry
from config.private_media import PrivateMediaWidget


class PrivateReceiptFormMixin:
    def formfield_for_dbfield(self, db_field, request, **kwargs):
        if db_field.name == "file":
            kwargs["widget"] = PrivateMediaWidget(request, "contribution")
        return super().formfield_for_dbfield(db_field, request, **kwargs)


class ContributionAttachmentInline(PrivateReceiptFormMixin, admin.TabularInline):
    model = ContributionAttachment
    extra = 0
    readonly_fields = ("created_at",)


@admin.register(Contribution)
class ContributionAdmin(admin.ModelAdmin):
    list_display = ("member", "category", "amount", "status_badge", "contribution_date", "reviewed_by")
    list_filter = ("status", "category", "contribution_date", "member", "church")
    search_fields = ("member__full_name", "notes")
    autocomplete_fields = ("church", "member", "created_by", "reviewed_by")
    date_hierarchy = "contribution_date"
    inlines = [ContributionAttachmentInline]

    @admin.display(description="Status")
    def status_badge(self, obj: Contribution):
        colors = {
            Contribution.Status.PENDING: "#f59e0b",
            Contribution.Status.APPROVED: "#16a34a",
            Contribution.Status.REJECTED: "#dc2626",
            Contribution.Status.NEEDS_REVIEW: "#7c3aed",
        }
        if obj.status == Contribution.Status.PENDING:
            label = "PENDENTE"
        else:
            label = obj.get_status_display().upper()
        return format_html(
            '<strong style="color: {};">{}</strong>',
            colors.get(obj.status, "#374151"),
            label,
        )


@admin.register(ContributionAttachment)
class ContributionAttachmentAdmin(PrivateReceiptFormMixin, admin.ModelAdmin):
    list_display = ("contribution", "original_name", "uploaded_by", "created_at")
    autocomplete_fields = ("contribution", "uploaded_by")


@admin.register(FinancialEntry)
class FinancialEntryAdmin(admin.ModelAdmin):
    list_display = ("description", "entry_type", "category", "amount", "due_date", "status", "church")
    list_filter = ("entry_type", "category", "status", "source", "church")
    search_fields = ("description", "notes", "member__full_name", "event__name")
    autocomplete_fields = ("church", "member", "event", "contribution", "created_by")
    date_hierarchy = "due_date"
