from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import HasMemberProfile, IsScheduleCoordinatorOrAdmin, get_member_profile
from apps.members.models import Member
from apps.ministries.models import MinistryRole

from .models import Schedule, ScheduleAssignment
from .serializers import (
    ScheduleAssignmentActionSerializer,
    ScheduleAssignmentDetailSerializer,
    ScheduleAssignmentSerializer,
    ScheduleCreateSerializer,
    ScheduleSubstitutionSerializer,
)


def _event_window(event):
    start = event.start_at
    end = event.end_at or start + timedelta(hours=2)
    return start, end


def conflicting_assignments(assignment):
    start, end = _event_window(assignment.schedule.event)
    candidates = ScheduleAssignment.objects.filter(
        church=assignment.church,
        member=assignment.member,
    ).exclude(schedule_id=assignment.schedule_id).exclude(
        status__in=[ScheduleAssignment.Status.DECLINED, ScheduleAssignment.Status.UNAVAILABLE]
    ).select_related("schedule__event")
    return [
        other for other in candidates
        if (lambda other_start_end: start < other_start_end[1] and other_start_end[0] < end)(_event_window(other.schedule.event))
    ]


def can_manage_schedule(user, schedule):
    if user.is_superuser or user.has_role(user.Role.ADMIN, user.Role.PASTOR):
        return True
    if not user.has_role(user.Role.COORDINATOR):
        return False
    return schedule.assignments.filter(ministry_role__ministry__coordinators=user).exists()


class MyScheduleAssignmentsView(generics.ListAPIView):
    serializer_class = ScheduleAssignmentSerializer
    permission_classes = [HasMemberProfile]
    queryset = ScheduleAssignment.objects.none()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return ScheduleAssignment.objects.none()
        return (
            ScheduleAssignment.objects.filter(
                member=get_member_profile(self.request.user),
                church=self.request.user.church,
                schedule__status=Schedule.Status.PUBLISHED,
            )
            .select_related("schedule__event", "ministry_role__ministry")
            .order_by("schedule__event__start_at")
        )


class MyScheduleAssignmentDetailView(generics.RetrieveAPIView):
    serializer_class = ScheduleAssignmentDetailSerializer
    permission_classes = [HasMemberProfile]
    queryset = ScheduleAssignment.objects.none()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return ScheduleAssignment.objects.none()
        return ScheduleAssignment.objects.filter(
            member=get_member_profile(self.request.user),
            church=self.request.user.church,
        ).select_related("schedule__event", "ministry_role__ministry", "schedule__worship_team")


class ScheduleAssignmentActionView(APIView):
    serializer_class = ScheduleAssignmentActionSerializer
    permission_classes = [HasMemberProfile]

    @extend_schema(request=ScheduleAssignmentActionSerializer, responses=ScheduleAssignmentSerializer)
    def post(self, request, pk: int):
        assignment = generics.get_object_or_404(
            ScheduleAssignment.objects.select_related("member", "schedule__event"),
            pk=pk,
            member=get_member_profile(request.user),
            church=request.user.church,
        )
        serializer = ScheduleAssignmentActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        action = serializer.validated_data["action"]
        if action == "confirm":
            conflicts = conflicting_assignments(assignment)
            if conflicts:
                assignment.status = ScheduleAssignment.Status.CONFLICT
                assignment.conflict_reason = "Ja existe outra escala no mesmo horario."
                assignment.save(update_fields=["status", "conflict_reason", "updated_at"])
                return Response(ScheduleAssignmentSerializer(assignment).data, status=status.HTTP_409_CONFLICT)
            assignment.status = ScheduleAssignment.Status.CONFIRMED
        elif action == "unavailable":
            assignment.status = ScheduleAssignment.Status.UNAVAILABLE
        else:
            assignment.status = ScheduleAssignment.Status.DECLINED
        assignment.justification = serializer.validated_data.get("justification", "")
        assignment.responded_at = timezone.now()
        assignment.save(update_fields=["status", "justification", "responded_at", "updated_at"])
        return Response(ScheduleAssignmentSerializer(assignment).data, status=status.HTTP_200_OK)


class ScheduleCreateView(generics.CreateAPIView):
    serializer_class = ScheduleCreateSerializer
    permission_classes = [IsScheduleCoordinatorOrAdmin]


class SchedulePublishView(APIView):
    permission_classes = [IsScheduleCoordinatorOrAdmin]

    def post(self, request, pk: int):
        schedule = generics.get_object_or_404(
            Schedule.objects.prefetch_related("assignments__ministry_role__ministry"),
            pk=pk,
            church=request.user.church,
        )
        if not can_manage_schedule(request.user, schedule):
            return Response({"detail": "Voce nao tem escopo para esta escala."}, status=status.HTTP_403_FORBIDDEN)
        if schedule.status == Schedule.Status.CANCELLED:
            return Response({"detail": "Uma escala cancelada nao pode ser publicada."}, status=status.HTTP_400_BAD_REQUEST)
        schedule.status = Schedule.Status.PUBLISHED
        schedule.published_at = timezone.now()
        schedule.save(update_fields=["status", "published_at", "updated_at"])
        return Response({"id": schedule.id, "status": schedule.status, "published_at": schedule.published_at})


class ScheduleSubstitutionView(APIView):
    permission_classes = [IsScheduleCoordinatorOrAdmin]

    @extend_schema(request=ScheduleSubstitutionSerializer, responses=ScheduleAssignmentSerializer)
    @transaction.atomic
    def post(self, request, schedule_pk: int, assignment_pk: int):
        schedule = generics.get_object_or_404(Schedule, pk=schedule_pk, church=request.user.church)
        if not can_manage_schedule(request.user, schedule):
            return Response({"detail": "Voce nao tem escopo para esta escala."}, status=status.HTTP_403_FORBIDDEN)
        original = generics.get_object_or_404(
            ScheduleAssignment.objects.select_related("ministry_role"),
            pk=assignment_pk,
            schedule=schedule,
            church=request.user.church,
        )
        serializer = ScheduleSubstitutionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        member = generics.get_object_or_404(Member, pk=serializer.validated_data["member_id"], church=request.user.church)
        role_id = serializer.validated_data.get("ministry_role_id", original.ministry_role_id)
        role = generics.get_object_or_404(MinistryRole, pk=role_id, church=request.user.church)
        replacement = ScheduleAssignment.objects.create(
            church=request.user.church,
            schedule=schedule,
            member=member,
            ministry_role=role,
            substitution_for=original,
            justification=serializer.validated_data.get("justification", ""),
        )
        original.status = ScheduleAssignment.Status.REPLACEMENT_NEEDED
        original.justification = serializer.validated_data.get("justification", "")
        original.save(update_fields=["status", "justification", "updated_at"])
        return Response(ScheduleAssignmentSerializer(replacement).data, status=status.HTTP_201_CREATED)
from rest_framework import viewsets

from .models import PersonalCommitment
from .serializers import PersonalCommitmentSerializer


class PersonalCommitmentViewSet(viewsets.ModelViewSet):
    serializer_class = PersonalCommitmentSerializer
    permission_classes = [HasMemberProfile]
    queryset = PersonalCommitment.objects.none()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return PersonalCommitment.objects.none()
        return PersonalCommitment.objects.filter(
            member=get_member_profile(self.request.user),
            church=self.request.user.church,
        )

    def perform_create(self, serializer):
        serializer.save(church=self.request.user.church, member=get_member_profile(self.request.user))
