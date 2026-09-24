from rest_framework import mixins, viewsets
from rest_framework.generics import RetrieveAPIView
from rest_framework.permissions import IsAuthenticated

from apps.accounts.permissions import HasMemberProfile, IsMemberDirectoryUser, get_member_profile

from .models import Member, MemberUpdateRequest
from .serializers import MemberSerializer, MemberUpdateRequestSerializer


class MemberDirectoryViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Lista administrativa de membros e visitantes da igreja autenticada."""

    serializer_class = MemberSerializer
    permission_classes = [IsAuthenticated, IsMemberDirectoryUser]
    queryset = Member.objects.none()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Member.objects.none()
        queryset = Member.objects.filter(church=self.request.user.church).prefetch_related("ministries")
        status = self.request.query_params.get("status")
        if status:
            queryset = queryset.filter(status=status)
        return queryset.order_by("full_name")


class MyMemberView(RetrieveAPIView):
    """Cadastro de membro do usuario autenticado."""

    serializer_class = MemberSerializer
    permission_classes = [HasMemberProfile]

    def get_object(self):
        return get_member_profile(self.request.user)


class MyMemberUpdateRequestViewSet(mixins.CreateModelMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    """Permite ao membro solicitar alteracoes sem editar o cadastro diretamente."""

    serializer_class = MemberUpdateRequestSerializer
    permission_classes = [HasMemberProfile]
    queryset = MemberUpdateRequest.objects.none()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return MemberUpdateRequest.objects.none()
        return MemberUpdateRequest.objects.filter(
            member=get_member_profile(self.request.user),
            church=self.request.user.church,
        )

    def perform_create(self, serializer):
        serializer.save(
            church=self.request.user.church,
            member=get_member_profile(self.request.user),
        )
