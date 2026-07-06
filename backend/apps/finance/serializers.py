from rest_framework import serializers

from .models import Contribution, ContributionAttachment
from .validators import validate_contribution_attachment


class ContributionAttachmentSerializer(serializers.ModelSerializer):
    file_url = serializers.FileField(source="file", read_only=True)

    class Meta:
        model = ContributionAttachment
        fields = ("id", "original_name", "file_url", "created_at")


class ContributionSerializer(serializers.ModelSerializer):
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
