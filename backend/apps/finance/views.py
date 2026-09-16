from django.utils import timezone
from rest_framework import generics, mixins, parsers, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import HasMemberProfile, IsTreasurerOrAdmin, get_member_profile

from .models import Contribution
from .serializers import ContributionReviewSerializer, ContributionSerializer


class MyStatementView(generics.ListAPIView):
    """Extrato do membro autenticado."""

    serializer_class = ContributionSerializer
    permission_classes = [HasMemberProfile]
    queryset = Contribution.objects.none()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Contribution.objects.none()
        return Contribution.objects.filter(
            member=get_member_profile(self.request.user),
            church=self.request.user.church,
        ).prefetch_related("attachments")


class ContributionViewSet(mixins.CreateModelMixin, viewsets.GenericViewSet):
    """Envio de contribuicao e revisao restrita a tesouraria."""

    serializer_class = ContributionSerializer
    permission_classes = [HasMemberProfile]
    parser_classes = (parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser)
    queryset = Contribution.objects.none()

    def get_permissions(self):
        if getattr(self, "action", None) == "review":
            return [IsTreasurerOrAdmin()]
        return [HasMemberProfile()]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Contribution.objects.none()
        if getattr(self, "action", None) == "review":
            return Contribution.objects.filter(church=self.request.user.church).select_related("member")
        return Contribution.objects.filter(
            member=get_member_profile(self.request.user),
            church=self.request.user.church,
        )

    def perform_create(self, serializer):
        serializer.save(
            church=self.request.user.church,
            member=get_member_profile(self.request.user),
            created_by=self.request.user,
        )

    @action(detail=True, methods=["post"], url_path="review")
    def review(self, request, pk=None):
        contribution = self.get_object()
        serializer = ContributionReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        contribution.status = serializer.validated_data["status"]
        contribution.notes = serializer.validated_data.get("review_notes", contribution.notes)
        contribution.reviewed_by = request.user
        contribution.reviewed_at = timezone.now()
        contribution.save(update_fields=("status", "notes", "reviewed_by", "reviewed_at", "updated_at"))
        return Response(ContributionSerializer(contribution).data, status=status.HTTP_200_OK)