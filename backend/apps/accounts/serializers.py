from rest_framework import serializers

from apps.accounts.models import User


class MeSerializer(serializers.ModelSerializer):
    member_id = serializers.IntegerField(source="member_profile.id", read_only=True)
    member_name = serializers.CharField(source="member_profile.full_name", read_only=True)
    church_name = serializers.CharField(source="church.name", read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "first_name",
            "last_name",
            "phone",
            "role",
            "church",
            "church_name",
            "member_id",
            "member_name",
        )
