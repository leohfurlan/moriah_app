from rest_framework import serializers

from .models import ScheduleAssignment, ScheduleItem


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


class ScheduleItemSerializer(serializers.ModelSerializer):
    item_type_display = serializers.CharField(source="get_item_type_display", read_only=True)

    class Meta:
        model = ScheduleItem
        fields = (
            "id",
            "order",
            "item_type",
            "item_type_display",
            "title",
            "song_key",
            "reference_url",
            "notes",
        )


class TeamMemberSerializer(serializers.ModelSerializer):
    """Um integrante da equipe escalada, na visao de quem esta consultando."""

    member_name = serializers.CharField(source="member.full_name", read_only=True)
    role_name = serializers.CharField(source="ministry_role.name", read_only=True)
    ministry_name = serializers.CharField(source="ministry_role.ministry.name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    is_me = serializers.SerializerMethodField()

    class Meta:
        model = ScheduleAssignment
        fields = (
            "id",
            "member_name",
            "role_name",
            "ministry_name",
            "status",
            "status_display",
            "is_me",
        )

    def get_is_me(self, obj) -> bool:
        return obj.member_id == self.context.get("member_id")


class ScheduleAssignmentDetailSerializer(ScheduleAssignmentSerializer):
    """Detalhe da escala: equipe completa e repertorio do culto.

    Deliberadamente **nao** expoe telefone, e-mail ou qualquer dado pessoal dos
    outros escalados — apenas nome, funcao e status de confirmacao, que e o
    necessario para a equipe se organizar.
    """

    event_location = serializers.CharField(source="schedule.event.location", read_only=True)
    event_type = serializers.CharField(source="schedule.event.event_type", read_only=True)
    schedule_notes = serializers.CharField(source="schedule.notes", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    team = serializers.SerializerMethodField()
    repertoire = serializers.SerializerMethodField()

    class Meta(ScheduleAssignmentSerializer.Meta):
        fields = ScheduleAssignmentSerializer.Meta.fields + (
            "status_display",
            "event_location",
            "event_type",
            "schedule_notes",
            "team",
            "repertoire",
        )

    def get_team(self, obj) -> list:
        assignments = (
            ScheduleAssignment.objects.filter(schedule_id=obj.schedule_id)
            .select_related("member", "ministry_role__ministry")
            .order_by("ministry_role__ministry__name", "ministry_role__name", "member__full_name")
        )
        return TeamMemberSerializer(
            assignments, many=True, context={"member_id": obj.member_id}
        ).data

    def get_repertoire(self, obj) -> list:
        return ScheduleItemSerializer(obj.schedule.items.all(), many=True).data
