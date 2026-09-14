from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import HasMemberProfile, get_member_profile

from .models import ScheduleAssignment
from .serializers import (
    ScheduleAssignmentActionSerializer,
    ScheduleAssignmentDetailSerializer,
    ScheduleAssignmentSerializer,
)


class MyScheduleAssignmentsView(generics.ListAPIView):
    """Escalas do membro autenticado."""

    serializer_class = ScheduleAssignmentSerializer
    permission_classes = [HasMemberProfile]
    # Ver nota em finance.views: exigido pela introspeccao do schema.
    queryset = ScheduleAssignment.objects.none()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return ScheduleAssignment.objects.none()
        return (
            ScheduleAssignment.objects.filter(member=get_member_profile(self.request.user))
            .select_related("schedule__event", "ministry_role__ministry")
            .order_by("schedule__event__start_at")
        )


class MyScheduleAssignmentDetailView(generics.RetrieveAPIView):
    """Detalhe de uma escala do proprio membro: equipe e repertorio.

    A busca e sempre filtrada pelo membro autenticado: escala de outra pessoa
    responde 404, sem revelar que existe.
    """

    serializer_class = ScheduleAssignmentDetailSerializer
    permission_classes = [HasMemberProfile]
    queryset = ScheduleAssignment.objects.none()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return ScheduleAssignment.objects.none()
        return ScheduleAssignment.objects.filter(
            member=get_member_profile(self.request.user)
        ).select_related("schedule__event", "ministry_role__ministry")


class ScheduleAssignmentActionView(APIView):
    """Confirmacao ou recusa de uma escala do proprio membro."""

    serializer_class = ScheduleAssignmentActionSerializer
    permission_classes = [HasMemberProfile]

    @extend_schema(
        request=ScheduleAssignmentActionSerializer,
        responses=ScheduleAssignmentSerializer,
    )
    def post(self, request, pk: int):
        assignment = generics.get_object_or_404(
            ScheduleAssignment.objects.select_related("member"),
            pk=pk,
            member=get_member_profile(request.user),
        )
        serializer = ScheduleAssignmentActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        action = serializer.validated_data["action"]
        assignment.status = (
            ScheduleAssignment.Status.CONFIRMED
            if action == "confirm"
            else ScheduleAssignment.Status.DECLINED
        )
        assignment.justification = serializer.validated_data.get("justification", "")
        assignment.responded_at = timezone.now()
        assignment.save(update_fields=["status", "justification", "responded_at", "updated_at"])
        return Response(ScheduleAssignmentSerializer(assignment).data, status=status.HTTP_200_OK)
