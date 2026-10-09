from rest_framework import mixins, serializers, status, viewsets
from rest_framework.permissions import IsAuthenticated, BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.generics import RetrieveAPIView
from rest_framework.permissions import IsAuthenticated

from apps.accounts.pagination import OptionalPaginationMixin
from apps.accounts.permissions import HasMemberProfile, IsMemberDirectoryUser, get_member_profile

from .models import Member, MemberLinkRequest, MemberUpdateRequest
from .serializers import MemberSerializer, MemberUpdateRequestSerializer
from .linking import can_review, open_request, review_request
from rest_framework.decorators import action
from django.db.models import Q


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


class MyMemberUpdateRequestViewSet(OptionalPaginationMixin, mixins.CreateModelMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    """Permite ao membro solicitar alteracoes sem editar o cadastro diretamente."""

    serializer_class = MemberUpdateRequestSerializer
    permission_classes = [HasMemberProfile]
    queryset = MemberUpdateRequest.objects.none()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return MemberUpdateRequest.objects.none()
        queryset = MemberUpdateRequest.objects.filter(
            member=get_member_profile(self.request.user),
            church=self.request.user.church,
        )
        request_status = self.request.query_params.get("status")
        if request_status:
            queryset = queryset.filter(status=request_status)
        return queryset

    def perform_create(self, serializer):
        serializer.save(
            church=self.request.user.church,
            member=get_member_profile(self.request.user),
        )


class MemberLinkRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = MemberLinkRequest
        fields = ("id", "status", "created_at", "review_notes", "reviewed_at")
        read_only_fields = fields


class MyMemberLinkRequestView(APIView):
    """Solicita revisão humana para vincular uma conta a um cadastro existente."""

    permission_classes = [IsAuthenticated]
    serializer_class = MemberLinkRequestSerializer

    def get(self, request):
        queryset = MemberLinkRequest.objects.filter(user=request.user, church=request.user.church)
        return Response(MemberLinkRequestSerializer(queryset, many=True).data)

    def post(self, request):
        item, created = open_request(request.user)
        return Response(MemberLinkRequestSerializer(item).data, status=201 if created else 200)


class CanReviewMemberLinks(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user.is_authenticated and can_review(request.user))


class LinkReviewSerializer(serializers.ModelSerializer):
    requester_name = serializers.SerializerMethodField()
    requester_email = serializers.EmailField(source="requested_email", read_only=True)
    candidate_name = serializers.CharField(source="candidate_member.full_name", default=None, read_only=True)
    reviewer_name = serializers.SerializerMethodField()

    def get_requester_name(self, obj):
        return obj.user.get_full_name() or obj.requested_email

    def get_reviewer_name(self, obj):
        return (obj.reviewed_by.get_full_name() or obj.reviewed_by.email) if obj.reviewed_by else None

    class Meta:
        model = MemberLinkRequest
        fields = ("id", "user_id", "requester_name", "requester_email", "candidate_member",
                  "candidate_name", "status", "created_at", "review_notes", "reviewed_at", "reviewer_name")
        read_only_fields = fields


class LinkDecisionSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(choices=("approved", "rejected"))
    candidate_member = serializers.IntegerField(min_value=1, required=False, allow_null=True)
    review_notes = serializers.CharField(required=False, allow_blank=True, max_length=2000)


class MemberLinkReviewViewSet(OptionalPaginationMixin, viewsets.ReadOnlyModelViewSet):
    serializer_class = LinkReviewSerializer
    permission_classes = [IsAuthenticated, CanReviewMemberLinks]
    queryset = MemberLinkRequest.objects.none()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return MemberLinkRequest.objects.none()
        qs = MemberLinkRequest.objects.filter(church=self.request.user.church).select_related("user", "candidate_member", "reviewed_by")
        if self.action == "list" and self.request.query_params.get("status"):
            selected = self.request.query_params["status"]
            if selected not in {"pending", "approved", "rejected"}:
                raise serializers.ValidationError("Situação inválida.")
            qs = qs.filter(status=selected)
        return qs

    @action(detail=True, methods=["get"])
    def candidates(self, request, pk=None):
        self.get_object()
        term = request.query_params.get("search", "").strip()
        item = self.get_object()
        qs = Member.objects.filter(church=request.user.church).filter(
            Q(user__isnull=True) | Q(user_id=item.user_id, status=Member.Status.VISITOR)
        )
        if term:
            qs = qs.filter(Q(full_name__icontains=term) | Q(email__icontains=term))
        return Response(list(qs.order_by("full_name").values("id", "full_name", "email", "status")[:50]))

    @action(detail=True, methods=["post"])
    def review(self, request, pk=None):
        item = self.get_object()
        data = LinkDecisionSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        values = data.validated_data
        updated = review_request(request.user, item.pk, values["decision"],
                                 values.get("candidate_member"), values.get("review_notes", ""))
        return Response(self.get_serializer(updated).data)
