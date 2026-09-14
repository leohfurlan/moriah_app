from rest_framework import serializers

from .models import Family, FamilyRelationship, Member


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
            "id",
            "full_name",
            "preferred_name",
            "email",
            "phone",
            "birth_date",
            "address",
            "marital_status",
            "status",
            "joined_at",
            "notes",
            "family",
            "family_relationships",
            "cell",
            "cell_name",
            "ministry_names",
        )

    def get_ministry_names(self, obj) -> list[str]:
        return list(obj.ministries.values_list("name", flat=True))
