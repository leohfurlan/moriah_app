from rest_framework import serializers

from .models import Family, FamilyRelationship, Member, MemberUpdateRequest


class FamilySerializer(serializers.ModelSerializer):
    class Meta:
        model = Family
        fields = ("id", "name")


class FamilyRelationshipSerializer(serializers.ModelSerializer):
    related_member_name = serializers.CharField(source="related_member.full_name", read_only=True)

    class Meta:
        model = FamilyRelationship
        fields = ("id", "relationship_type", "related_member", "related_member_name")


class MemberSerializer(serializers.ModelSerializer):
    family = FamilySerializer(read_only=True)
    family_relationships = FamilyRelationshipSerializer(many=True, read_only=True)
    cell_name = serializers.CharField(source="cell.name", read_only=True)
    ministry_names = serializers.SerializerMethodField()

    class Meta:
        model = Member
        fields = (
            "id", "full_name", "preferred_name", "email", "phone", "birth_date",
            "address", "marital_status", "status", "joined_at", "notes", "family",
            "family_relationships", "cell", "cell_name", "ministry_names",
        )

    def get_ministry_names(self, obj) -> list[str]:
        return list(obj.ministries.values_list("name", flat=True))


class MemberUpdateRequestSerializer(serializers.ModelSerializer):
    ALLOWED_FIELDS = frozenset({
        "full_name", "preferred_name", "email", "phone", "birth_date",
        "address", "marital_status",
    })

    class Meta:
        model = MemberUpdateRequest
        fields = ("id", "requested_changes", "status", "review_notes", "created_at", "reviewed_at")
        read_only_fields = ("status", "review_notes", "created_at", "reviewed_at")

    def validate_requested_changes(self, value):
        if not isinstance(value, dict) or not value:
            raise serializers.ValidationError("Informe ao menos um dado para alterar.")
        unknown = set(value) - self.ALLOWED_FIELDS
        if unknown:
            raise serializers.ValidationError(
                {field: "Este campo nao pode ser alterado pelo app." for field in sorted(unknown)}
            )
        return value