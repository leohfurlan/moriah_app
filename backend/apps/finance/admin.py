from django.contrib import admin
from django.utils.html import format_html

from .models import Contribution, ContributionAttachment


class ContributionAttachmentInline(admin.TabularInline):
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
class ContributionAttachmentAdmin(admin.ModelAdmin):
    list_display = ("contribution", "original_name", "uploaded_by", "created_at")
    autocomplete_fields = ("contribution", "uploaded_by")
