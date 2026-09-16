from rest_framework import serializers

from apps.accounts.models import User
from apps.accounts.permissions import can_access_management, get_member_profile, user_capabilities


class MeSerializer(serializers.ModelSerializer):
    member_id = serializers.SerializerMethodField()
    member_name = serializers.SerializerMethodField()
    church_name = serializers.CharField(source="church.name", read_only=True)
    roles = serializers.SerializerMethodField()
    capabilities = serializers.SerializerMethodField()
    has_member_profile = serializers.SerializerMethodField()
    can_access_management = serializers.SerializerMethodField()

    def get_member_id(self, obj):
        member = get_member_profile(obj)
        return member.id if member else None

    def get_member_name(self, obj):
        member = get_member_profile(obj)
        return member.full_name if member else None

    def get_roles(self, obj):
        return sorted(obj.assigned_roles())

    def get_capabilities(self, obj):
        return user_capabilities(obj)

    def get_has_member_profile(self, obj):
        return get_member_profile(obj) is not None

    def get_can_access_management(self, obj):
        return can_access_management(obj)

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
            "roles",
            "capabilities",
            "has_member_profile",
            "can_access_management",
        )
