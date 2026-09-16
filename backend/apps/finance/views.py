from datetime import date

from django.db import transaction
from django.utils import timezone
from rest_framework import generics, mixins, parsers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
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


class ContributionViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """Envio de contribuicao e revisao restrita a tesouraria."""

    serializer_class = ContributionSerializer
    permission_classes = [HasMemberProfile]
    parser_classes = (parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser)
    queryset = Contribution.objects.none()

    def get_permissions(self):
        if getattr(self, "action", None) in {"list", "retrieve", "review"}:
            return [IsTreasurerOrAdmin()]
        return [HasMemberProfile()]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Contribution.objects.none()
        if getattr(self, "action", None) in {"list", "retrieve", "review"}:
            queryset = Contribution.objects.filter(church=self.request.user.church).select_related("member", "reviewed_by")
            if getattr(self, "action", None) == "list":
                status_filter = self.request.query_params.get("status")
                if status_filter:
                    queryset = queryset.filter(status=status_filter)
                date_from = self.request.query_params.get("date_from")
                date_to = self.request.query_params.get("date_to")
                if date_from:
                    queryset = queryset.filter(contribution_date__gte=self._parse_date_filter("date_from", date_from))
                if date_to:
                    queryset = queryset.filter(contribution_date__lte=self._parse_date_filter("date_to", date_to))
            return queryset
        return Contribution.objects.filter(
            member=get_member_profile(self.request.user),
            church=self.request.user.church,
        )

    @staticmethod
    def _parse_date_filter(name, value):
        try:
            return date.fromisoformat(value)
        except ValueError as exc:
            raise ValidationError({name: "Use a data no formato AAAA-MM-DD."}) from exc

    def perform_create(self, serializer):
        serializer.save(
            church=self.request.user.church,
            member=get_member_profile(self.request.user),
            created_by=self.request.user,
        )

    @action(detail=True, methods=["post"], url_path="review")
    def review(self, request, pk=None):
        serializer = ContributionReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        target_status = serializer.validated_data["status"]
        review_notes = serializer.validated_data.get("review_notes", "").strip()
        if target_status == Contribution.Status.REJECTED and not review_notes:
            return Response({"review_notes": ["Informe o motivo da rejeição."]}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)
        contribution = self.get_object()
        with transaction.atomic():
            contribution = self.get_queryset().select_for_update().get(pk=contribution.pk)
            final_statuses = {Contribution.Status.APPROVED, Contribution.Status.REJECTED}
            if contribution.status in final_statuses:
                if contribution.status == target_status:
                    return Response(ContributionSerializer(contribution, context={"request": request}).data)
                return Response({"detail": "Esta contribuição já foi decidida e não pode ser alterada."}, status=status.HTTP_409_CONFLICT)
            if contribution.status not in {Contribution.Status.PENDING, Contribution.Status.NEEDS_REVIEW}:
                return Response({"detail": "O status atual não permite esta decisão."}, status=status.HTTP_409_CONFLICT)
            contribution.status = target_status
            contribution.review_notes = review_notes
            contribution.reviewed_by = request.user
            contribution.reviewed_at = timezone.now()
            contribution.save(update_fields=("status", "review_notes", "reviewed_by", "reviewed_at", "updated_at"))
        return Response(ContributionSerializer(contribution).data, status=status.HTTP_200_OK)