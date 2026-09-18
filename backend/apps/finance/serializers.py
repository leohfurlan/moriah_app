from rest_framework import serializers

from .models import Contribution, ContributionAttachment, FinancialEntry
from .validators import validate_contribution_attachment


class ContributionAttachmentSerializer(serializers.ModelSerializer):
    file_url = serializers.FileField(source="file", read_only=True)

    class Meta:
        model = ContributionAttachment
        fields = ("id", "original_name", "file_url", "created_at")


class ContributionSerializer(serializers.ModelSerializer):
    member_name = serializers.CharField(source="member.full_name", read_only=True)
    attachments = ContributionAttachmentSerializer(many=True, read_only=True)
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
            "attachments",
            "files",
            "created_at",
        )
        read_only_fields = ("status",)

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
            (Contribution.Status.NEEDS_REVIEW, "Precisa revisao"),
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
