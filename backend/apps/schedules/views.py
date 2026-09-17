from django.db import transaction
from django.db.models import Exists, OuterRef, Prefetch, Q
from django.utils import timezone
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import generics, serializers, status, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import SAFE_METHODS
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import HasMemberProfile, HasMemberProfileOrAdmin, IsScheduleCoordinatorOrAdmin, get_member_profile, is_admin_user
from apps.audit.models import AuditLog
from apps.audit.notification_service import create_notification
from apps.members.models import Member
from apps.ministries.models import Ministry

from . import services
from .models import PersonalCommitment, Schedule, ScheduleAssignment
from .serializers import (
    PersonalCommitmentSerializer,
    ScheduleAdminDetailSerializer,
    ScheduleAdminListSerializer,
    ScheduleAssignmentActionSerializer,
    ScheduleAssignmentCreateSerializer,
    ScheduleAssignmentDetailSerializer,
    ScheduleAssignmentSerializer,
    ScheduleCandidateSerializer,
    ScheduleCreateSerializer,
    ScheduleSubstitutionSerializer,
    resolve_assignment_target,
    ScheduleTeamMemberAdminSerializer,
    ScheduleUpdateSerializer,
)

# Mensagem unica de escopo: a mesma para admin sem vinculo e coordenador de
# outro ministerio, para nao revelar a existencia da escala de outra igreja.
NO_SCOPE_MESSAGE = "Voce nao tem escopo para esta escala."


def record_audit(user, action, instance, payload=None):
    """Grava a acao administrativa na trilha de auditoria."""
    return AuditLog.objects.create(
        church=getattr(instance, "church", None),
        user=user if getattr(user, "is_authenticated", False) else None,
        action=action,
        model_name=instance.__class__.__name__,
        object_id=str(instance.pk),
        payload=payload or {},
    )


def notify_schedule_assignment(schedule, assignment):
    create_notification(
        user=getattr(assignment.member, "user", None),
        church=schedule.church,
        category="Escalas",
        title="Nova escala para voce",
        body=f"{schedule.name} · {schedule.event.name}",
        detail=f"Voce foi escalado para {schedule.name}. Confira os detalhes e confirme sua presenca.",
        action_label="Abrir minhas escalas",
        action_route="/schedules",
        dedupe_key=f"schedule-published-{schedule.pk}-assignment-{assignment.pk}",
    )


def conflicting_assignments(assignment):
    """Outras escalas do membro no mesmo horario (compatibilidade de API)."""
    return services.overlapping_assignments(assignment.member, assignment.schedule)


def can_manage_schedule(user, schedule) -> bool:
    return services.can_manage_schedule(user, schedule)


def _managed_schedule_or_404(user, pk, *, lock=False):
    queryset = Schedule.objects.select_related("event", "ministry", "created_by")
    if lock:
        # Lock apenas na escala: os JOINs de ministry/created_by podem ser nulos.
        queryset = queryset.select_for_update(of=("self",))
    schedule = generics.get_object_or_404(
        queryset,
        pk=pk,
        church=user.church,
    )
    if not services.can_manage_schedule(user, schedule):
        raise PermissionDenied(NO_SCOPE_MESSAGE)
    return schedule


class MyScheduleAssignmentsView(generics.ListAPIView):
    serializer_class = ScheduleAssignmentSerializer
    permission_classes = [HasMemberProfileOrAdmin]
    queryset = ScheduleAssignment.objects.none()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return ScheduleAssignment.objects.none()
        user = self.request.user
        queryset = ScheduleAssignment.objects.filter(
            church=user.church,
            schedule__status=Schedule.Status.PUBLISHED,
        )
        if not is_admin_user(user):
            member = get_member_profile(user)
            if member is None:
                return ScheduleAssignment.objects.none()
            queryset = queryset.filter(member=member)
        return queryset.select_related("schedule__event", "ministry_role__ministry", "member").order_by("schedule__event__start_at")


class MyScheduleAssignmentDetailView(generics.RetrieveAPIView):
    serializer_class = ScheduleAssignmentDetailSerializer
    permission_classes = [HasMemberProfileOrAdmin]
    queryset = ScheduleAssignment.objects.none()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return ScheduleAssignment.objects.none()
        user = self.request.user
        queryset = ScheduleAssignment.objects.filter(church=user.church)
        if not is_admin_user(user):
            member = get_member_profile(user)
            if member is None:
                return ScheduleAssignment.objects.none()
            queryset = queryset.filter(member=member, schedule__status=Schedule.Status.PUBLISHED)
        return queryset.select_related("schedule__event", "ministry_role__ministry", "member", "schedule__worship_team")


class ScheduleAssignmentActionView(APIView):
    serializer_class = ScheduleAssignmentActionSerializer
    permission_classes = [HasMemberProfile]

    @extend_schema(
        request=ScheduleAssignmentActionSerializer,
        responses={
            200: ScheduleAssignmentSerializer,
            409: inline_serializer(
                name="ScheduleAssignmentActionError",
                fields={
                    "detail": serializers.CharField(),
                    "code": serializers.CharField(required=False),
                    "status": serializers.CharField(required=False),
                    "conflict_reason": serializers.CharField(required=False),
                },
            ),
        },
    )
    def post(self, request, pk: int):
        assignment = generics.get_object_or_404(
            ScheduleAssignment.objects.select_related("member", "schedule__event"),
            pk=pk,
            member=get_member_profile(request.user),
            church=request.user.church,
        )
        if assignment.schedule.status != Schedule.Status.PUBLISHED:
            return Response(
                {
                    "detail": (
                        "Escala cancelada nao aceita novas respostas."
                        if assignment.schedule.status == Schedule.Status.CANCELLED
                        else "Escala ainda nao publicada nao aceita respostas."
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )
        serializer = ScheduleAssignmentActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        action = serializer.validated_data["action"]
        if action == "confirm":
            reason = services.conflict_reason(assignment.member, assignment.schedule)
            if reason:
                assignment.status = ScheduleAssignment.Status.CONFLICT
                assignment.conflict_reason = reason
                assignment.save(update_fields=["status", "conflict_reason", "updated_at"])
                payload = dict(ScheduleAssignmentSerializer(assignment).data)
                payload.update(detail=reason, code="schedule_conflict")
                return Response(payload, status=status.HTTP_409_CONFLICT)
            assignment.status = ScheduleAssignment.Status.CONFIRMED
            assignment.conflict_reason = ""
        elif action == "unavailable":
            assignment.status = ScheduleAssignment.Status.UNAVAILABLE
        else:
            assignment.status = ScheduleAssignment.Status.DECLINED
        assignment.justification = serializer.validated_data.get("justification", "")
        assignment.responded_at = timezone.now()
        assignment.save(update_fields=["status", "justification", "conflict_reason", "responded_at", "updated_at"])
        return Response(ScheduleAssignmentSerializer(assignment).data, status=status.HTTP_200_OK)


class ScheduleListCreateView(generics.ListCreateAPIView):
    """GET lista as escalas da gestao; POST cria evento + escala (rascunho)."""

    permission_classes = [IsScheduleCoordinatorOrAdmin]
    queryset = Schedule.objects.none()

    def get_serializer_class(self):
        if self.request.method == "POST":
            return ScheduleCreateSerializer
        return ScheduleAdminListSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Schedule.objects.none()
        queryset = (
            services.managed_schedules(self.request.user)
            .select_related("event", "ministry")
            .prefetch_related("assignments")
        )
        status_filter = self.request.query_params.get("status")
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        ministry_filter = self.request.query_params.get("ministry")
        if ministry_filter:
            queryset = queryset.filter(ministry_id=ministry_filter)
        search = self.request.query_params.get("q")
        if search:
            queryset = queryset.filter(Q(name__icontains=search) | Q(event__name__icontains=search))
        return queryset.order_by("-event__start_at")

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        schedule = serializer.save()
        record_audit(
            request.user,
            "schedule_created",
            schedule,
            {"name": schedule.name, "ministry": schedule.ministry_id, "status": schedule.status},
        )
        detail = ScheduleAdminDetailSerializer(schedule, context=self.get_serializer_context())
        return Response(detail.data, status=status.HTTP_201_CREATED)


class ScheduleDetailView(generics.RetrieveUpdateAPIView):
    """Detalhe completo da escala e edicao de rascunho/ajustes."""

    permission_classes = [IsScheduleCoordinatorOrAdmin]
    queryset = Schedule.objects.none()

    def get_serializer_class(self):
        if self.request.method in ("PATCH", "PUT"):
            return ScheduleUpdateSerializer
        return ScheduleAdminDetailSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Schedule.objects.none()
        return (
            services.managed_schedules(self.request.user)
            .select_related("event", "ministry", "created_by")
            .prefetch_related("assignments__ministry_role__ministry", "assignments__member")
        )

    def get_object(self):
        return _managed_schedule_or_404(self.request.user, self.kwargs["pk"])

    def update(self, request, *args, **kwargs):
        schedule = self.get_object()
        if schedule.status == Schedule.Status.CANCELLED:
            return Response(
                {"detail": "Escala cancelada nao pode ser editada."},
                status=status.HTTP_409_CONFLICT,
            )
        serializer = self.get_serializer(schedule, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        record_audit(request.user, "schedule_updated", schedule, {"fields": sorted(request.data.keys())})
        detail = ScheduleAdminDetailSerializer(schedule, context=self.get_serializer_context())
        return Response(detail.data, status=status.HTTP_200_OK)


class SchedulePublishView(APIView):
    permission_classes = [IsScheduleCoordinatorOrAdmin]

    @extend_schema(request=None, responses=ScheduleAdminDetailSerializer)
    @transaction.atomic
    def post(self, request, pk: int):
        schedule = _managed_schedule_or_404(request.user, pk, lock=True)
        publication_error = services.publication_error(
            schedule.status, schedule.assignments.exists()
        )
        if publication_error:
            return Response(
                {"detail": publication_error},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if schedule.status == Schedule.Status.PUBLISHED:
            # Idempotente: republicar nao reescreve published_at nem notifica de novo.
            detail = ScheduleAdminDetailSerializer(schedule, context={"request": request})
            return Response(detail.data, status=status.HTTP_200_OK)
        schedule.status = Schedule.Status.PUBLISHED
        schedule.published_at = timezone.now()
        schedule.save(update_fields=["status", "published_at", "updated_at"])
        for assignment in schedule.assignments.select_related("member__user"):
            notify_schedule_assignment(schedule, assignment)
        record_audit(
            request.user,
            "schedule_published",
            schedule,
            {"published_at": schedule.published_at.isoformat()},
        )
        detail = ScheduleAdminDetailSerializer(schedule, context={"request": request})
        return Response(detail.data, status=status.HTTP_200_OK)


class ScheduleCancelView(APIView):
    permission_classes = [IsScheduleCoordinatorOrAdmin]

    @extend_schema(request=None, responses=ScheduleAdminDetailSerializer)
    @transaction.atomic
    def post(self, request, pk: int):
        schedule = _managed_schedule_or_404(request.user, pk, lock=True)
        if schedule.status != Schedule.Status.CANCELLED:
            previous_status = schedule.status
            schedule.status = Schedule.Status.CANCELLED
            schedule.save(update_fields=["status", "updated_at"])
            record_audit(request.user, "schedule_cancelled", schedule, {"previous_status": previous_status})
        detail = ScheduleAdminDetailSerializer(schedule, context={"request": request})
        return Response(detail.data, status=status.HTTP_200_OK)


class ScheduleCandidatesView(generics.ListAPIView):
    """Candidatos para escalar (lacuna C3): membros ativos, com conflito visivel."""

    serializer_class = ScheduleCandidateSerializer
    permission_classes = [IsScheduleCoordinatorOrAdmin]
    queryset = Member.objects.none()

    def get_schedule(self):
        schedule = generics.get_object_or_404(
            Schedule.objects.select_related("event", "ministry"),
            pk=self.kwargs["pk"],
            church=self.request.user.church,
        )
        if not services.can_manage_schedule(self.request.user, schedule):
            raise PermissionDenied(NO_SCOPE_MESSAGE)
        return schedule

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Member.objects.none()
        self.schedule = self.get_schedule()
        queryset = Member.objects.filter(
            church=self.request.user.church,
            status=Member.Status.ACTIVE,
        )
        if self.schedule.ministry_id:
            through = Ministry.members.through
            queryset = queryset.annotate(
                in_ministry=Exists(
                    through.objects.filter(
                        ministry_id=self.schedule.ministry_id,
                        member_id=OuterRef("pk"),
                    )
                )
            )
            if self.request.query_params.get("in_ministry") in {"1", "true", "sim"}:
                queryset = queryset.filter(in_ministry=True)
            queryset = queryset.order_by("-in_ministry", "full_name")
        else:
            queryset = queryset.order_by("full_name")
        search = self.request.query_params.get("q")
        if search:
            queryset = queryset.filter(
                Q(full_name__icontains=search) | Q(preferred_name__icontains=search)
            )
        role_assignments = ScheduleAssignment.objects.filter(
            church=self.schedule.church,
        ).select_related("ministry_role")
        return queryset.prefetch_related(
            "ministries",
            "worship_team_memberships",
            Prefetch("schedule_assignments", queryset=role_assignments, to_attr="_candidate_role_assignments"),
        )

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["schedule"] = getattr(self, "schedule", None)
        return context


class ScheduleAssignmentCreateView(APIView):
    """Adiciona um integrante a escala, sinalizando conflito de agenda."""

    permission_classes = [IsScheduleCoordinatorOrAdmin]

    @extend_schema(request=ScheduleAssignmentCreateSerializer, responses=ScheduleTeamMemberAdminSerializer)
    @transaction.atomic
    def post(self, request, pk: int):
        schedule = _managed_schedule_or_404(request.user, pk, lock=True)
        if schedule.status == Schedule.Status.CANCELLED:
            return Response(
                {"detail": "Escala cancelada nao recebe novos integrantes."},
                status=status.HTTP_409_CONFLICT,
            )
        serializer = ScheduleAssignmentCreateSerializer(data=request.data, context={"schedule": schedule})
        serializer.is_valid(raise_exception=True)
        member = serializer.validated_data["member"]
        role = serializer.validated_data["ministry_role"]
        if ScheduleAssignment.objects.filter(schedule=schedule, member=member, ministry_role=role).exists():
            return Response(
                {"detail": "Este membro ja esta escalado nesta funcao."},
                status=status.HTTP_409_CONFLICT,
            )
        assignment = services.add_assignment(
            schedule, member, role, serializer.validated_data.get("justification", "")
        )
        if schedule.status == Schedule.Status.PUBLISHED:
            notify_schedule_assignment(schedule, assignment)
        record_audit(
            request.user,
            "schedule_assignment_added",
            schedule,
            {
                "assignment": assignment.pk,
                "member": member.pk,
                "ministry_role": role.pk,
                "status": assignment.status,
                "conflict_reason": assignment.conflict_reason,
            },
        )
        return Response(ScheduleTeamMemberAdminSerializer(assignment).data, status=status.HTTP_201_CREATED)


class ScheduleAssignmentDeleteView(APIView):
    """Remove um integrante; desfazer substituicao devolve o original a pendente."""

    permission_classes = [IsScheduleCoordinatorOrAdmin]

    @extend_schema(request=None, responses={204: None, 404: None, 409: None})
    def delete(self, request, schedule_pk: int, assignment_pk: int):
        schedule = _managed_schedule_or_404(request.user, schedule_pk)
        assignment = generics.get_object_or_404(
            ScheduleAssignment.objects.select_related("member", "ministry_role", "substitution_for"),
            pk=assignment_pk,
            schedule=schedule,
            church=request.user.church,
        )
        if assignment.substitutions.exists():
            return Response(
                {"detail": "Remova antes a substituicao vinculada a este integrante."},
                status=status.HTTP_409_CONFLICT,
            )
        payload = {
            "assignment": assignment.pk,
            "member": assignment.member_id,
            "ministry_role": assignment.ministry_role_id,
            "replaced_assignment": assignment.substitution_for_id,
        }
        original = assignment.substitution_for
        with transaction.atomic():
            assignment.delete()
            if original is not None:
                original.status = ScheduleAssignment.Status.PENDING
                original.justification = ""
                original.responded_at = None
                original.save(update_fields=["status", "justification", "responded_at", "updated_at"])
                payload["restored_assignment"] = original.pk
        record_audit(request.user, "schedule_assignment_removed", schedule, payload)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ScheduleSubstitutionView(APIView):
    permission_classes = [IsScheduleCoordinatorOrAdmin]

    @extend_schema(request=ScheduleSubstitutionSerializer, responses=ScheduleAssignmentSerializer)
    @transaction.atomic
    def post(self, request, schedule_pk: int, assignment_pk: int):
        schedule = _managed_schedule_or_404(request.user, schedule_pk, lock=True)
        original = generics.get_object_or_404(
            ScheduleAssignment.objects.select_related("ministry_role"),
            pk=assignment_pk,
            schedule=schedule,
            church=request.user.church,
        )
        serializer = ScheduleSubstitutionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        role_id = serializer.validated_data.get("ministry_role_id", original.ministry_role_id)
        member, role = resolve_assignment_target(
            schedule.church, schedule.ministry, serializer.validated_data["member_id"], role_id
        )
        justification = serializer.validated_data.get("justification", "")
        reason = services.conflict_reason(member, schedule)
        replacement = ScheduleAssignment.objects.create(
            church=request.user.church,
            schedule=schedule,
            member=member,
            ministry_role=role,
            substitution_for=original,
            justification=justification,
            status=ScheduleAssignment.Status.CONFLICT if reason else ScheduleAssignment.Status.PENDING,
            conflict_reason=reason,
        )
        if schedule.status == Schedule.Status.PUBLISHED:
            notify_schedule_assignment(schedule, replacement)
        original.status = ScheduleAssignment.Status.REPLACEMENT_NEEDED
        original.justification = justification
        original.save(update_fields=["status", "justification", "updated_at"])
        record_audit(
            request.user,
            "schedule_substitution_created",
            schedule,
            {
                "assignment": replacement.pk,
                "replaced_assignment": original.pk,
                "member": member.pk,
                "ministry_role": role.pk,
                "conflict_reason": reason,
            },
        )
        return Response(ScheduleTeamMemberAdminSerializer(replacement).data, status=status.HTTP_201_CREATED)


class PersonalCommitmentViewSet(viewsets.ModelViewSet):
    serializer_class = PersonalCommitmentSerializer
    permission_classes = [HasMemberProfileOrAdmin]
    queryset = PersonalCommitment.objects.none()

    def get_permissions(self):
        if self.request.method in SAFE_METHODS:
            return [HasMemberProfileOrAdmin()]
        return [HasMemberProfile()]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return PersonalCommitment.objects.none()
        user = self.request.user
        queryset = PersonalCommitment.objects.filter(church=user.church)
        member = get_member_profile(user)
        if member is None:
            return PersonalCommitment.objects.none()
        return queryset.filter(member=member)

    def perform_create(self, serializer):
        serializer.save(church=self.request.user.church, member=get_member_profile(self.request.user))
