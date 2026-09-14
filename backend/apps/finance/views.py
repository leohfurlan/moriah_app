from rest_framework import generics, mixins, parsers, viewsets

from apps.accounts.permissions import HasMemberProfile, get_member_profile

from .models import Contribution
from .serializers import ContributionSerializer


class MyStatementView(generics.ListAPIView):
    """Extrato do membro autenticado."""

    serializer_class = ContributionSerializer
    permission_classes = [HasMemberProfile]
    # Necessario para a introspeccao do schema (drf-spectacular), que resolve o
    # model sem um usuario autenticado. O queryset real vem de get_queryset().
    queryset = Contribution.objects.none()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Contribution.objects.none()
        return Contribution.objects.filter(
            member=get_member_profile(self.request.user)
        ).prefetch_related("attachments")


class ContributionViewSet(mixins.CreateModelMixin, viewsets.GenericViewSet):
    """Envio de contribuicao com comprovante pelo membro autenticado."""

    serializer_class = ContributionSerializer
    permission_classes = [HasMemberProfile]
    parser_classes = (parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser)
    queryset = Contribution.objects.none()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Contribution.objects.none()
        return Contribution.objects.filter(member=get_member_profile(self.request.user))

    def perform_create(self, serializer):
        serializer.save(
            church=self.request.user.church,
            member=get_member_profile(self.request.user),
            created_by=self.request.user,
        )
