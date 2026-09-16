from rest_framework import mixins, viewsets
from rest_framework.generics import RetrieveAPIView

from apps.accounts.permissions import HasMemberProfile, get_member_profile

from .models import MemberUpdateRequest
from .serializers import MemberSerializer, MemberUpdateRequestSerializer


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