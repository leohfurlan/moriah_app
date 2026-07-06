from rest_framework import mixins, status, viewsets
from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError

from apps.accounts.permissions import IsCellLeaderOrAdmin
from apps.members.models import Member

from .models import Cell
from .serializers import CellMeetingSerializer, LeaderCellMemberSerializer


class LeaderCellMembersView(ListAPIView):
    serializer_class = LeaderCellMemberSerializer
    permission_classes = [IsCellLeaderOrAdmin]

    def get_queryset(self):
        return Member.objects.filter(cell__leader=self.request.user).select_related("cell")


class CellMeetingViewSet(mixins.CreateModelMixin, viewsets.GenericViewSet):
    serializer_class = CellMeetingSerializer
    permission_classes = [IsCellLeaderOrAdmin]

    def create(self, request, *args, **kwargs):
        cell = Cell.objects.filter(leader=request.user).first()
        if not cell:
            raise ValidationError("O usuario logado nao lidera nenhuma celula.")
        serializer = self.get_serializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(church=request.user.church, cell=cell, created_by=request.user)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
