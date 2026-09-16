from rest_framework import serializers

from apps.audit.models import AuditLog

from .models import Contribution, ContributionAttachment
from .validators import validate_contribution_attachment


class ContributionAttachmentSerializer(serializers.ModelSerializer):
    file_url = serializers.FileField(source="file", read_only=True)

    class Meta:
        model = ContributionAttachment
        fields = ("id", "original_name", "file_url", "created_at")


class ContributionSerializer(serializers.ModelSerializer):
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

    def get_reviewed_by_name(self, obj):
        return obj.reviewed_by.get_full_name() or obj.reviewed_by.email if obj.reviewed_by else None

    def get_review_history(self, obj):
        return [
            {
                "status_before": log.payload.get("before", {}).get("status"),
                "status_after": log.payload.get("after", {}).get("status"),
                "reviewed_by_name": (log.user.get_full_name() or log.user.email) if log.user else None,
                "created_at": log.created_at,
            }
            for log in AuditLog.objects.filter(
                model_name="Contribution",
                object_id=str(obj.pk),
                action="contribution_status_changed",
            ).select_related("user")
        ]

    def create(self, validated_data):
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
        return contribution

class ContributionReviewSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=(
            (Contribution.Status.APPROVED, "Aprovada"),
            (Contribution.Status.REJECTED, "Rejeitada"),
        )
    )
    review_notes = serializers.CharField(required=False, allow_blank=True)