from rest_framework import serializers

from .models import Ministry, MinistryRole


class MinistryRoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = MinistryRole
        fields = ("id", "name", "description")


class MinistrySerializer(serializers.ModelSerializer):
    """Ministerio com funcoes e coordenadores, para montar a escala no app."""

    roles = MinistryRoleSerializer(many=True, read_only=True)
    coordinator_names = serializers.SerializerMethodField()
    members_count = serializers.SerializerMethodField()

    class Meta:
        model = Ministry
        fields = ("id", "name", "description", "roles", "coordinator_names", "members_count")

    def get_coordinator_names(self, obj) -> list:
        return [user.get_full_name() or user.email for user in obj.coordinators.all()]

    def get_members_count(self, obj) -> int:
        return obj.members.count()
