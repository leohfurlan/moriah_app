from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from apps.events.models import Event
from .models import Schedule, ScheduleAssignment, ScheduleItem


class ScheduleAssignmentSerializer(serializers.ModelSerializer):
    event_name = serializers.CharField(source="schedule.event.name", read_only=True)
    event_start_at = serializers.DateTimeField(source="schedule.event.start_at", read_only=True)
    schedule_name = serializers.CharField(source="schedule.name", read_only=True)
    role_name = serializers.CharField(source="ministry_role.name", read_only=True)
    ministry_name = serializers.CharField(source="ministry_role.ministry.name", read_only=True)
    schedule_status = serializers.CharField(source="schedule.status", read_only=True)
    arrival_at = serializers.DateTimeField(source="schedule.arrival_at", read_only=True)
    rehearsal_at = serializers.DateTimeField(source="schedule.rehearsal_at", read_only=True)

    class Meta:
        model = ScheduleAssignment
        fields = (
            "id", "schedule", "schedule_name", "schedule_status", "event_name", "event_start_at",
            "arrival_at", "rehearsal_at", "role_name", "ministry_name", "status", "justification",
            "conflict_reason", "substitution_for", "responded_at",
        )


class ScheduleAssignmentActionSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=("confirm", "decline", "unavailable"))
    justification = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        if attrs["action"] in {"decline", "unavailable"} and not attrs.get("justification"):
            raise serializers.ValidationError({"justification": "Informe a justificativa."})
        return attrs


class ScheduleItemSerializer(serializers.ModelSerializer):
    item_type_display = serializers.CharField(source="get_item_type_display", read_only=True)
    song_title = serializers.CharField(source="song.title", read_only=True, allow_null=True)
    artist = serializers.CharField(source="song.artist", read_only=True, allow_null=True)
    effective_key = serializers.SerializerMethodField()
    effective_bpm = serializers.SerializerMethodField()
    effective_duration_seconds = serializers.SerializerMethodField()
    spotify_url = serializers.CharField(source="song.spotify_url", read_only=True, allow_null=True)
    youtube_url = serializers.CharField(source="song.youtube_url", read_only=True, allow_null=True)
    chord_url = serializers.CharField(source="song.chord_url", read_only=True, allow_null=True)

    class Meta:
        model = ScheduleItem
        fields = (
            "id", "order", "item_type", "item_type_display", "song", "title", "song_title", "artist",
            "song_key", "effective_key", "bpm", "effective_bpm", "duration_seconds",
            "effective_duration_seconds", "reference_url", "spotify_url", "youtube_url", "chord_url", "notes",
        )

    def get_effective_key(self, obj):
        return obj.song_key or (obj.song.default_key if obj.song else "")

    def get_effective_bpm(self, obj):
        return obj.bpm if obj.bpm is not None else (obj.song.bpm if obj.song else None)

    def get_effective_duration_seconds(self, obj):
        return obj.duration_seconds if obj.duration_seconds is not None else (obj.song.duration_seconds if obj.song else None)


class TeamMemberSerializer(serializers.ModelSerializer):
    member_name = serializers.CharField(source="member.full_name", read_only=True)
    role_name = serializers.CharField(source="ministry_role.name", read_only=True)
    ministry_name = serializers.CharField(source="ministry_role.ministry.name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    is_me = serializers.SerializerMethodField()

    class Meta:
        model = ScheduleAssignment
        fields = (
            "id", "member_name", "role_name", "ministry_name", "status", "status_display",
            "conflict_reason", "substitution_for", "is_me",
        )

    def get_is_me(self, obj) -> bool:
        return obj.member_id == self.context.get("member_id")


class ScheduleAssignmentDetailSerializer(ScheduleAssignmentSerializer):
    event_location = serializers.CharField(source="schedule.event.location", read_only=True)
    event_type = serializers.CharField(source="schedule.event.event_type", read_only=True)
    schedule_notes = serializers.CharField(source="schedule.notes", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    team = serializers.SerializerMethodField()
    repertoire = serializers.SerializerMethodField()

    class Meta(ScheduleAssignmentSerializer.Meta):
        fields = ScheduleAssignmentSerializer.Meta.fields + (
            "status_display", "event_location", "event_type", "schedule_notes", "team", "repertoire",
        )

    def get_team(self, obj) -> list:
        assignments = (
            ScheduleAssignment.objects.filter(schedule_id=obj.schedule_id, church=obj.church_id)
            .select_related("member", "ministry_role__ministry")
            .order_by("ministry_role__ministry__name", "ministry_role__name", "member__full_name")
        )
        return TeamMemberSerializer(assignments, many=True, context={"member_id": obj.member_id}).data

    def get_repertoire(self, obj) -> list:
        if obj.schedule.status == obj.schedule.Status.CANCELLED:
            return []
        items = obj.schedule.items.select_related("song").all()
        return ScheduleItemSerializer(items, many=True).data


class ScheduleSubstitutionSerializer(serializers.Serializer):
    member_id = serializers.IntegerField()
    ministry_role_id = serializers.IntegerField(required=False)
    justification = serializers.CharField(required=False, allow_blank=True)


class ScheduleCreateSerializer(serializers.Serializer):
    """Contrato enxuto para criar um evento e sua escala no MVP."""

    id = serializers.IntegerField(read_only=True)
    event_name = serializers.CharField(max_length=255, write_only=True)
    event_type = serializers.ChoiceField(choices=Event.EventType.choices, default=Event.EventType.SERVICE, write_only=True)
    start_at = serializers.DateTimeField(write_only=True)
    end_at = serializers.DateTimeField(required=False, allow_null=True, write_only=True)
    location = serializers.CharField(max_length=255, required=False, allow_blank=True, write_only=True)
    schedule_name = serializers.CharField(max_length=255, write_only=True)
    notes = serializers.CharField(required=False, allow_blank=True, write_only=True)
    status = serializers.ChoiceField(choices=Schedule.Status.choices, default=Schedule.Status.PUBLISHED, write_only=True)
    arrival_at = serializers.DateTimeField(required=False, allow_null=True, write_only=True)
    rehearsal_at = serializers.DateTimeField(required=False, allow_null=True, write_only=True)

    @transaction.atomic
    def create(self, validated_data):
        request = self.context["request"]
        church = request.user.church
        event = Event.objects.create(
            church=church,
            name=validated_data.pop("event_name"),
            event_type=validated_data.pop("event_type"),
            start_at=validated_data.pop("start_at"),
            end_at=validated_data.pop("end_at", None),
            location=validated_data.pop("location", ""),
        )
        status_value = validated_data.pop("status", Schedule.Status.PUBLISHED)
        return Schedule.objects.create(
            church=church,
            event=event,
            name=validated_data.pop("schedule_name"),
            status=status_value,
            created_by=request.user,
            published_at=timezone.now() if status_value == Schedule.Status.PUBLISHED else None,
            **validated_data,
        )
from .models import PersonalCommitment


class PersonalCommitmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = PersonalCommitment
        fields = ("id", "title", "commitment_type", "starts_at", "ends_at", "status", "notes", "created_at", "updated_at")
        read_only_fields = ("created_at", "updated_at")

    def validate(self, attrs):
        starts_at = attrs.get("starts_at", getattr(self.instance, "starts_at", None))
        ends_at = attrs.get("ends_at", getattr(self.instance, "ends_at", None))
        if starts_at and ends_at and ends_at <= starts_at:
            raise serializers.ValidationError({"ends_at": "O termino deve ser depois do inicio."})
        return attrs