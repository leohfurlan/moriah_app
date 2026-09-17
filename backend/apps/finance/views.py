from datetime import date

from django.db import transaction
from django.utils import timezone
from rest_framework import generics, mixins, parsers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiParameter, OpenApiTypes

from apps.accounts.permissions import HasMemberProfile, HasMemberProfileOrAdmin, IsTreasurerOrAdmin, get_member_profile, is_admin_user

from .models import Contribution
from .serializers import ContributionReviewSerializer, ContributionSerializer


class MyStatementView(generics.ListAPIView):
    """Extrato pessoal; para admin, leitura consolidada da igreja."""

    serializer_class = ContributionSerializer
    permission_classes = [HasMemberProfileOrAdmin]
    queryset = Contribution.objects.none()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Contribution.objects.none()
        user = self.request.user
        if is_admin_user(user):
            return Contribution.objects.filter(
                church=user.church,
            ).select_related("member", "reviewed_by").prefetch_related("attachments")
        member = get_member_profile(user)
        if member is None:
            return Contribution.objects.none()
        return Contribution.objects.filter(
            member=member,
            church=user.church,
        ).prefetch_related("attachments")


@extend_schema_view(
    list=extend_schema(parameters=[
        OpenApiParameter("status", OpenApiTypes.STR, enum=Contribution.Status.values),
        OpenApiParameter("date_from", OpenApiTypes.DATE),
        OpenApiParameter("date_to", OpenApiTypes.DATE),
    ]),
    review=extend_schema(request=ContributionReviewSerializer, responses=ContributionSerializer),
)
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
            queryset = (
                Contribution.objects.filter(church=self.request.user.church)
                .select_related("member", "reviewed_by")
                .prefetch_related("attachments")
            )
            if getattr(self, "action", None) == "list":
                status_filter = self.request.query_params.get("status")
                if status_filter:
                    if status_filter not in Contribution.Status.values:
                        raise ValidationError({"status": "Status de contribuição inválido."})
                    queryset = queryset.filter(status=status_filter)
                date_from = self.request.query_params.get("date_from")
                date_to = self.request.query_params.get("date_to")
                start = self._parse_date_filter("date_from", date_from) if date_from else None
                end = self._parse_date_filter("date_to", date_to) if date_to else None
                if start and end and start > end:
                    raise ValidationError({"date_to": "A data final deve ser igual ou posterior à inicial."})
                if start:
                    queryset = queryset.filter(contribution_date__gte=start)
                if end:
                    queryset = queryset.filter(contribution_date__lte=end)
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
        contribution = self.get_object()
        with transaction.atomic():
            # O JOIN de reviewed_by e opcional; somente a contribuicao deve ser bloqueada.
            contribution = self.get_queryset().select_for_update(of=("self",)).get(pk=contribution.pk)
            final_statuses = {Contribution.Status.APPROVED, Contribution.Status.REJECTED}
            if contribution.status in final_statuses:
                if contribution.status == target_status:
                    return Response(ContributionSerializer(contribution, context={"request": request}).data)
                return Response({"detail": "Esta contribuição já foi decidida e não pode ser alterada."}, status=status.HTTP_409_CONFLICT)
            if contribution.status not in {Contribution.Status.PENDING, Contribution.Status.NEEDS_REVIEW}:
                return Response({"detail": "O status atual não permite esta decisão."}, status=status.HTTP_409_CONFLICT)
            if target_status == Contribution.Status.REJECTED and not review_notes:
                return Response({"review_notes": ["Informe o motivo da rejeição."]}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)
            contribution.status = target_status
            contribution.review_notes = review_notes
            contribution.reviewed_by = request.user
            contribution.reviewed_at = timezone.now()
            contribution.save(update_fields=("status", "review_notes", "reviewed_by", "reviewed_at", "updated_at"))
        return Response(self.get_serializer(contribution).data, status=status.HTTP_200_OK)
