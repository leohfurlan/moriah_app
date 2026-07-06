from django.utils import timezone
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ScheduleAssignment
from .serializers import ScheduleAssignmentActionSerializer, ScheduleAssignmentSerializer


class MyScheduleAssignmentsView(generics.ListAPIView):
    serializer_class = ScheduleAssignmentSerializer

    def get_queryset(self):
        return (
            ScheduleAssignment.objects.filter(member=self.request.user.member_profile)
            .select_related("schedule__event", "ministry_role__ministry")
            .order_by("schedule__event__start_at")
        )


class ScheduleAssignmentActionView(APIView):
    def post(self, request, pk: int):
        assignment = generics.get_object_or_404(
            ScheduleAssignment.objects.select_related("member"),
            pk=pk,
            member=request.user.member_profile,
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
