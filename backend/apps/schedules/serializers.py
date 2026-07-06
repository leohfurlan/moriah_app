from rest_framework import serializers

from .models import ScheduleAssignment


class ScheduleAssignmentSerializer(serializers.ModelSerializer):
    event_name = serializers.CharField(source="schedule.event.name", read_only=True)
    event_start_at = serializers.DateTimeField(source="schedule.event.start_at", read_only=True)
    schedule_name = serializers.CharField(source="schedule.name", read_only=True)
    role_name = serializers.CharField(source="ministry_role.name", read_only=True)
    ministry_name = serializers.CharField(source="ministry_role.ministry.name", read_only=True)

    class Meta:
        model = ScheduleAssignment
        fields = (
            "id",
            "schedule",
            "schedule_name",
            "event_name",
            "event_start_at",
            "role_name",
            "ministry_name",
            "status",
            "justification",
            "responded_at",
        )


class ScheduleAssignmentActionSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=("confirm", "decline"))
    justification = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        if attrs["action"] == "decline" and not attrs.get("justification"):
            raise serializers.ValidationError({"justification": "Informe a justificativa para recusa."})
        return attrs
