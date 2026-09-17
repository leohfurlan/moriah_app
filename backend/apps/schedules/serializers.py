from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from apps.events.models import Event
from apps.members.models import Member
from apps.ministries.models import Ministry, MinistryRole

from . import services
from .models import PersonalCommitment, Schedule, ScheduleAssignment, ScheduleItem


class ScheduleAssignmentSerializer(serializers.ModelSerializer):
    member_name = serializers.CharField(source="member.full_name", read_only=True)
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
            "id", "schedule", "member_name", "schedule_name", "schedule_status", "event_name", "event_start_at",
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


class ScheduleAssignmentInputSerializer(serializers.Serializer):
    member_id = serializers.IntegerField()
    ministry_role_id = serializers.IntegerField()
    justification = serializers.CharField(required=False, allow_blank=True)


def resolve_assignment_target(church, ministry, member_id, ministry_role_id):
    """Resolve membro e funcao validando igreja e ministerio da escala."""
    member = Member.objects.filter(pk=member_id, church=church).first()
    if member is None:
        raise serializers.ValidationError({"member_id": "Membro nao encontrado nesta igreja."})
    role = (
        MinistryRole.objects.filter(pk=ministry_role_id, church=church)
        .select_related("ministry")
        .first()
    )
    if role is None:
        raise serializers.ValidationError({"ministry_role_id": "Funcao ministerial nao encontrada nesta igreja."})
    if ministry is not None and role.ministry_id != ministry.pk:
        raise serializers.ValidationError(
            {"ministry_role_id": f"A funcao {role.name} pertence ao ministerio {role.ministry.name}."}
        )
    return member, role


def count_assignments_by_status(assignments) -> dict:
    counts = {value: 0 for value, _ in ScheduleAssignment.Status.choices}
    for assignment in assignments:
        counts[assignment.status] = counts.get(assignment.status, 0) + 1
    counts["total"] = sum(counts.values())
    return counts


class ScheduleCreateSerializer(serializers.Serializer):
    """Contrato enxuto para criar um evento e sua escala no MVP.

    A escala nasce como rascunho -- publicar e acao explicita e idempotente --
    e o ministerio e obrigatorio para coordenador, que so monta escala do que
    coordena (lacuna C1 de docs/architecture/capacidades-mvp.md).
    """

    id = serializers.IntegerField(read_only=True)
    event_name = serializers.CharField(max_length=255, write_only=True)
    event_type = serializers.ChoiceField(choices=Event.EventType.choices, default=Event.EventType.SERVICE, write_only=True)
    start_at = serializers.DateTimeField(write_only=True)
    end_at = serializers.DateTimeField(required=False, allow_null=True, write_only=True)
    location = serializers.CharField(max_length=255, required=False, allow_blank=True, write_only=True)
    schedule_name = serializers.CharField(max_length=255, write_only=True)
    notes = serializers.CharField(required=False, allow_blank=True, write_only=True)
    ministry_id = serializers.IntegerField(required=False, allow_null=True, write_only=True)
    assignments = ScheduleAssignmentInputSerializer(many=True, required=False, write_only=True)
    status = serializers.ChoiceField(choices=Schedule.Status.choices, default=Schedule.Status.DRAFT, write_only=True)
    arrival_at = serializers.DateTimeField(required=False, allow_null=True, write_only=True)
    rehearsal_at = serializers.DateTimeField(required=False, allow_null=True, write_only=True)

    def validate(self, attrs):
        user = self.context["request"].user
        ministry = None
        ministry_id = attrs.get("ministry_id")
        if ministry_id is not None:
            ministry = Ministry.objects.filter(pk=ministry_id, church=user.church).first()
            if ministry is None:
                raise serializers.ValidationError({"ministry_id": "Ministerio nao encontrado nesta igreja."})
            if not services.can_manage_ministry(user, ministry):
                raise serializers.ValidationError({"ministry_id": "Voce coordena outro ministerio."})
        elif not (user.is_superuser or user.has_role(*services.MANAGE_ALL_ROLES)):
            raise serializers.ValidationError(
                {"ministry_id": "Informe o ministerio que voce coordena para criar a escala."}
            )
        status_value = attrs.get("status", Schedule.Status.DRAFT)
        if status_value == Schedule.Status.PUBLISHED:
            error = services.publication_error(status_value, bool(attrs.get("assignments")))
            if error:
                raise serializers.ValidationError({"status": error})
        attrs["ministry"] = ministry
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        request = self.context["request"]
        church = request.user.church
        ministry = validated_data.pop("ministry", None)
        rows = validated_data.pop("assignments", [])
        event = Event.objects.create(
            church=church,
            name=validated_data.pop("event_name"),
            event_type=validated_data.pop("event_type"),
            start_at=validated_data.pop("start_at"),
            end_at=validated_data.pop("end_at", None),
            location=validated_data.pop("location", ""),
        )
        status_value = validated_data.pop("status", Schedule.Status.DRAFT)
        schedule = Schedule.objects.create(
            church=church,
            event=event,
            ministry=ministry,
            name=validated_data.pop("schedule_name"),
            status=status_value,
            created_by=request.user,
            published_at=timezone.now() if status_value == Schedule.Status.PUBLISHED else None,
            **validated_data,
        )
        for row in rows:
            member, role = resolve_assignment_target(
                church, ministry, row["member_id"], row["ministry_role_id"]
            )
            services.add_assignment(schedule, member, role, row.get("justification", ""))
        return schedule


class ScheduleUpdateSerializer(serializers.ModelSerializer):
    """Edicao de rascunho: dados da escala e do evento vinculado."""

    ministry_id = serializers.IntegerField(required=False, allow_null=True, write_only=True)
    event_name = serializers.CharField(max_length=255, required=False, write_only=True)
    event_start_at = serializers.DateTimeField(required=False, write_only=True)
    event_end_at = serializers.DateTimeField(required=False, allow_null=True, write_only=True)
    event_location = serializers.CharField(max_length=255, required=False, allow_blank=True, write_only=True)

    class Meta:
        model = Schedule
        fields = (
            "name", "notes", "arrival_at", "rehearsal_at", "ministry_id",
            "event_name", "event_start_at", "event_end_at", "event_location",
        )

    def validate(self, attrs):
        attrs = super().validate(attrs)
        user = self.context["request"].user
        if "ministry_id" in attrs:
            ministry_id = attrs.pop("ministry_id")
            ministry = None
            if ministry_id is not None:
                ministry = Ministry.objects.filter(pk=ministry_id, church=user.church).first()
                if ministry is None:
                    raise serializers.ValidationError({"ministry_id": "Ministerio nao encontrado nesta igreja."})
                if not services.can_manage_ministry(user, ministry):
                    raise serializers.ValidationError({"ministry_id": "Voce coordena outro ministerio."})
            attrs["ministry"] = ministry
        event_changes = {}
        for field, model_field in (
            ("event_name", "name"),
            ("event_start_at", "start_at"),
            ("event_end_at", "end_at"),
            ("event_location", "location"),
        ):
            if field in attrs:
                event_changes[model_field] = attrs.pop(field)
        if event_changes:
            attrs["event_changes"] = event_changes
        return attrs

    def update(self, instance, validated_data):
        event_changes = validated_data.pop("event_changes", None)
        if event_changes:
            for field, value in event_changes.items():
                setattr(instance.event, field, value)
            instance.event.save(update_fields=list(event_changes))
        return super().update(instance, validated_data)


class ScheduleTeamMemberAdminSerializer(serializers.ModelSerializer):
    """Integrante da escala vistos pela gestao, com contato e conflito."""

    member_id = serializers.IntegerField(read_only=True)
    member_name = serializers.CharField(source="member.full_name", read_only=True)
    member_email = serializers.CharField(source="member.email", read_only=True)
    member_phone = serializers.CharField(source="member.phone", read_only=True)
    role_id = serializers.IntegerField(source="ministry_role_id", read_only=True)
    role_name = serializers.CharField(source="ministry_role.name", read_only=True)
    ministry_name = serializers.CharField(source="ministry_role.ministry.name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    replaced_member_name = serializers.SerializerMethodField()

    class Meta:
        model = ScheduleAssignment
        fields = (
            "id", "member_id", "member_name", "member_email", "member_phone",
            "role_id", "role_name", "ministry_name", "status", "status_display",
            "conflict_reason", "justification", "substitution_for",
            "replaced_member_name", "responded_at",
        )

    def get_replaced_member_name(self, obj) -> str:
        return obj.substitution_for.member.full_name if obj.substitution_for_id else ""


class ScheduleSubstitutionHistorySerializer(serializers.ModelSerializer):
    """Historico de substituicao: quem saiu, quem entrou e por que."""

    original_member_name = serializers.CharField(source="substitution_for.member.full_name", read_only=True)
    replacement_member_name = serializers.CharField(source="member.full_name", read_only=True)
    role_name = serializers.CharField(source="ministry_role.name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = ScheduleAssignment
        fields = (
            "id", "substitution_for", "original_member_name", "replacement_member_name",
            "role_name", "status", "status_display", "justification", "created_at",
        )


class ScheduleAssignmentCreateSerializer(serializers.Serializer):
    member_id = serializers.IntegerField()
    ministry_role_id = serializers.IntegerField()
    justification = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        schedule = self.context["schedule"]
        member, role = resolve_assignment_target(
            schedule.church, schedule.ministry, attrs["member_id"], attrs["ministry_role_id"]
        )
        attrs["member"] = member
        attrs["ministry_role"] = role
        return attrs


class ScheduleCandidateSerializer(serializers.ModelSerializer):
    """Candidato para escalar, com elegibilidade e choque de agenda (C3)."""

    ministry_names = serializers.SerializerMethodField()
    already_assigned = serializers.SerializerMethodField()
    available = serializers.SerializerMethodField()
    conflict_reason = serializers.SerializerMethodField()

    class Meta:
        model = Member
        fields = (
            "id", "full_name", "preferred_name", "email", "phone", "status",
            "ministry_names", "already_assigned", "available", "conflict_reason",
        )

    def get_ministry_names(self, obj) -> list:
        return [ministry.name for ministry in obj.ministries.all()]

    def get_already_assigned(self, obj) -> bool:
        schedule = self.context["schedule"]
        return any(assignment.member_id == obj.pk for assignment in schedule.assignments.all())

    def get_conflict_reason(self, obj) -> str:
        return services.conflict_reason(obj, self.context["schedule"])

    def get_available(self, obj) -> bool:
        return self.get_conflict_reason(obj) == ""


class ScheduleAdminListSerializer(serializers.ModelSerializer):
    """Linha da lista de gestao de escalas."""

    status_display = serializers.CharField(source="get_status_display", read_only=True)
    ministry_name = serializers.SerializerMethodField()
    event_name = serializers.CharField(source="event.name", read_only=True)
    event_type = serializers.CharField(source="event.event_type", read_only=True)
    event_start_at = serializers.DateTimeField(source="event.start_at", read_only=True)
    event_location = serializers.CharField(source="event.location", read_only=True)
    counts = serializers.SerializerMethodField()

    class Meta:
        model = Schedule
        fields = (
            "id", "name", "status", "status_display", "ministry", "ministry_name",
            "event", "event_name", "event_type", "event_start_at", "event_location",
            "arrival_at", "rehearsal_at", "published_at", "counts", "created_at",
        )

    def get_ministry_name(self, obj) -> str:
        return obj.ministry.name if obj.ministry_id else ""

    def get_counts(self, obj) -> dict:
        return count_assignments_by_status(obj.assignments.all())


class ScheduleAdminDetailSerializer(ScheduleAdminListSerializer):
    """Escala completa para a gestao: funcoes, equipe e substituicoes."""

    created_by_name = serializers.SerializerMethodField()
    ministry_roles = serializers.SerializerMethodField()
    team = serializers.SerializerMethodField()
    substitutions = serializers.SerializerMethodField()
    can_edit = serializers.SerializerMethodField()
    can_publish = serializers.SerializerMethodField()
    can_cancel = serializers.SerializerMethodField()

    class Meta(ScheduleAdminListSerializer.Meta):
        fields = ScheduleAdminListSerializer.Meta.fields + (
            "notes", "created_by", "created_by_name", "ministry_roles", "team",
            "substitutions", "can_edit", "can_publish", "can_cancel",
        )

    def get_created_by_name(self, obj) -> str:
        return obj.created_by.get_full_name() if obj.created_by_id else ""

    def get_ministry_roles(self, obj) -> list:
        if obj.ministry_id:
            roles = obj.ministry.roles.select_related("ministry").order_by("name")
        else:
            roles = (
                MinistryRole.objects.filter(church=obj.church_id)
                .select_related("ministry")
                .order_by("ministry__name", "name")
            )
        filled = {assignment.ministry_role_id for assignment in obj.assignments.all()}
        return [
            {
                "id": role.pk,
                "name": role.name,
                "ministry_id": role.ministry_id,
                "ministry_name": role.ministry.name,
                "is_filled": role.pk in filled,
            }
            for role in roles
        ]

    def get_team(self, obj) -> list:
        assignments = obj.assignments.select_related(
            "member", "ministry_role__ministry", "substitution_for__member"
        ).order_by("ministry_role__name", "member__full_name")
        return ScheduleTeamMemberAdminSerializer(assignments, many=True).data

    def get_substitutions(self, obj) -> list:
        rows = (
            obj.assignments.filter(substitution_for__isnull=False)
            .select_related("member", "substitution_for__member", "ministry_role")
            .order_by("-created_at")
        )
        return ScheduleSubstitutionHistorySerializer(rows, many=True).data

    def _can_manage(self, obj) -> bool:
        request = self.context.get("request")
        user = getattr(request, "user", None) or self.context.get("user")
        return services.can_manage_schedule(user, obj)

    def get_can_edit(self, obj) -> bool:
        return self._can_manage(obj) and obj.status != Schedule.Status.CANCELLED

    def get_can_publish(self, obj) -> bool:
        return self._can_manage(obj) and obj.status == Schedule.Status.DRAFT

    def get_can_cancel(self, obj) -> bool:
        return self._can_manage(obj) and obj.status != Schedule.Status.CANCELLED


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