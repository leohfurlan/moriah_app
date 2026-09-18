from django.db import transaction
from django.utils import timezone
from rest_framework import generics, mixins, parsers, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import HasMemberProfile, IsFinancialManager, get_member_profile

from .models import Contribution, FinancialEntry
from .serializers import ContributionReviewSerializer, ContributionSerializer, FinancialEntrySerializer
from .services import ensure_contribution_financial_entry


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


class ContributionViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    """Envio de contribuicao e revisao restrita a tesouraria."""

    serializer_class = ContributionSerializer
    permission_classes = [HasMemberProfile]
    parser_classes = (parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser)
    queryset = Contribution.objects.none()

    def get_permissions(self):
        if getattr(self, "action", None) == "list":
            return [IsFinancialManager()]
        if getattr(self, "action", None) == "review":
            return [IsFinancialManager()]
        return [HasMemberProfile()]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Contribution.objects.none()
        if getattr(self, "action", None) in {"list", "review"}:
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
        requested_status = serializer.validated_data["status"]
        with transaction.atomic():
            if (
                contribution.status == Contribution.Status.APPROVED
                and requested_status != Contribution.Status.APPROVED
                and hasattr(contribution, "financial_entry")
            ):
                return Response(
                    {"detail": "Esta contribuição já foi aceita e lançada no financeiro."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            contribution.status = requested_status
            contribution.notes = serializer.validated_data.get("review_notes", contribution.notes)
            contribution.reviewed_by = request.user
            contribution.reviewed_at = timezone.now()
            contribution.save(update_fields=("status", "notes", "reviewed_by", "reviewed_at", "updated_at"))
            if requested_status == Contribution.Status.APPROVED:
                ensure_contribution_financial_entry(contribution, request.user)
        return Response(ContributionSerializer(contribution).data, status=status.HTTP_200_OK)


class FinancialEntryViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    """Livro administrativo: entradas, saídas e vencimentos futuros."""

    serializer_class = FinancialEntrySerializer
    permission_classes = [IsFinancialManager]
    queryset = FinancialEntry.objects.none()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return FinancialEntry.objects.none()
        queryset = FinancialEntry.objects.filter(church=self.request.user.church).select_related("event", "member")
        entry_type = self.request.query_params.get("entry_type")
        entry_status = self.request.query_params.get("status")
        if entry_type in {choice.value for choice in FinancialEntry.EntryType}:
            queryset = queryset.filter(entry_type=entry_type)
        if entry_status in {choice.value for choice in FinancialEntry.Status}:
            queryset = queryset.filter(status=entry_status)
        return queryset

    def perform_create(self, serializer):
        serializer.save(church=self.request.user.church, created_by=self.request.user)

    def perform_update(self, serializer):
        instance = serializer.save()
        if instance.status == FinancialEntry.Status.PAID and instance.paid_at is None:
            instance.paid_at = timezone.now()
            instance.save(update_fields=("paid_at", "updated_at"))
