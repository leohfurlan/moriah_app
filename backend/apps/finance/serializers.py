from rest_framework import serializers
from django.conf import settings
from drf_spectacular.utils import extend_schema_field

from apps.audit.models import AuditLog

from .models import Contribution, ContributionAttachment, FinancialEntry, PixIntent
from django.db import transaction
from .validators import validate_contribution_attachment


class ContributionAttachmentSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    @extend_schema_field(serializers.URLField())
    def get_file_url(self, obj):
        request = self.context.get("request")
        if settings.PRIVATE_LOCAL_MEDIA and not settings.USE_S3_STORAGE:
            from config.private_media import private_file_url
            return private_file_url(request, "contribution", obj)
        if not obj.file:
            return None
        url = obj.file.url
        return request.build_absolute_uri(url) if request else url

    class Meta:
        model = ContributionAttachment
        fields = ("id", "original_name", "file_url", "created_at")


class ContributionReviewHistorySerializer(serializers.Serializer):
    status_before = serializers.CharField(allow_null=True)
    status_after = serializers.CharField()
    reviewed_by_name = serializers.CharField(allow_null=True)
    created_at = serializers.DateTimeField()


class ContributionSerializer(serializers.ModelSerializer):
    pix_intent_id = serializers.UUIDField(required=False, write_only=True)
    payment_origin = serializers.SerializerMethodField()

    def get_payment_origin(self, obj) -> str:
        return "cora_pix" if hasattr(obj, "pix_intent") else "receipt"

    def validate(self, attrs):
        intent_id = attrs.get("pix_intent_id")
        if intent_id:
            request = self.context["request"]
            from apps.accounts.permissions import get_member_profile
            intent = PixIntent.objects.filter(pk=intent_id, church=request.user.church, member=get_member_profile(request.user)).first()
            if not intent or intent.state != "ready":
                raise serializers.ValidationError({"pix_intent_id": "Cobrança indisponível para este comprovante."})
            if attrs["amount"] != intent.amount or attrs["category"] != intent.category:
                raise serializers.ValidationError({"pix_intent_id": "Valor e categoria devem corresponder ao Pix."})
            if not request.FILES.getlist("files") and not attrs.get("files"):
                raise serializers.ValidationError({"files": "Anexe um comprovante."})
        return attrs

    member_name = serializers.CharField(source="member.full_name", read_only=True)
    attachments = ContributionAttachmentSerializer(many=True, read_only=True)
    member_name = serializers.CharField(source="member.full_name", read_only=True)
    reviewed_by_name = serializers.SerializerMethodField()
    review_history = serializers.SerializerMethodField()
    files = serializers.ListField(
        child=serializers.FileField(),
        write_only=True,
        required=False,
        allow_empty=True,
    )

    class Meta:
        model = Contribution
        fields = (
            "id",
            "pix_intent_id",
            "payment_origin",
            "member_name",
            "category",
            "status",
            "amount",
            "contribution_date",
            "notes",
            "review_notes",
            "reviewed_by_name",
            "review_history",
            "attachments",
            "files",
            "created_at",
        )
        read_only_fields = ("status", "review_notes", "reviewed_by_name", "review_history")

    def get_reviewed_by_name(self, obj) -> str | None:
        return obj.reviewed_by.get_full_name() or obj.reviewed_by.email if obj.reviewed_by else None

    @extend_schema_field(ContributionReviewHistorySerializer(many=True))
    def get_review_history(self, obj):
        return [
            {
                "status_before": log.payload.get("before", {}).get("status"),
                "status_after": log.payload.get("after", {}).get("status"),
                "reviewed_by_name": (log.user.get_full_name() or log.user.email) if log.user else None,
                "created_at": log.created_at,
            }
            for log in AuditLog.objects.filter(
                church_id=obj.church_id,
                model_name="Contribution",
                object_id=str(obj.pk),
                action="contribution_status_changed",
            ).select_related("user")
        ]

    @transaction.atomic
    def create(self, validated_data):
        intent_id = validated_data.pop("pix_intent_id", None)
        intent = None
        if intent_id:
            intent = PixIntent.objects.select_for_update().get(pk=intent_id, church=validated_data["church"], member=validated_data["member"])
            if intent.contribution_id:
                return intent.contribution
        parsed_files = validated_data.pop("files", [])
        files = self.context["request"].FILES.getlist("files") or parsed_files
        for file in files:
            validate_contribution_attachment(file)
        contribution = Contribution.objects.create(**validated_data)
        for file in files:
            ContributionAttachment.objects.create(
                contribution=contribution,
                file=file,
                original_name=getattr(file, "name", ""),
                uploaded_by=self.context["request"].user,
            )
        if intent:
            intent.contribution = contribution
            intent.save(update_fields=["contribution", "updated_at"])
        return contribution

class ContributionReviewSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=(
            (Contribution.Status.APPROVED, "Aprovada"),
            (Contribution.Status.REJECTED, "Rejeitada"),
        )
    )
    review_notes = serializers.CharField(required=False, allow_blank=True)


class FinancialEntrySerializer(serializers.ModelSerializer):
    event_name = serializers.CharField(source="event.name", read_only=True)
    member_name = serializers.CharField(source="member.full_name", read_only=True)
    entry_type_display = serializers.CharField(source="get_entry_type_display", read_only=True)
    category_display = serializers.CharField(source="get_category_display", read_only=True)
    source_display = serializers.CharField(source="get_source_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = FinancialEntry
        fields = (
            "id", "entry_type", "entry_type_display", "category", "category_display",
            "source", "source_display", "status", "status_display", "description",
            "amount", "due_date", "paid_at", "notes", "member", "member_name",
            "event", "event_name", "contribution", "created_at",
        )
        read_only_fields = ("paid_at", "contribution")

    def validate(self, attrs):
        entry_type = attrs.get("entry_type", getattr(self.instance, "entry_type", None))
        current_type = getattr(self.instance, "entry_type", None)
        if entry_type == FinancialEntry.EntryType.INCOME and current_type != FinancialEntry.EntryType.INCOME:
            raise serializers.ValidationError(
                {"entry_type": "Entradas são criadas somente pelo aceite de uma contribuição."}
            )
        return attrs
