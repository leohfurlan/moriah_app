from rest_framework import mixins, serializers, status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.generics import RetrieveAPIView

from apps.accounts.pagination import OptionalPaginationMixin
from apps.accounts.permissions import HasMemberProfile, get_member_profile

from .models import Member, MemberLinkRequest, MemberUpdateRequest
from .serializers import MemberSerializer, MemberUpdateRequestSerializer


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
        fields = ("id", "status", "created_at")
        read_only_fields = fields


class MyMemberLinkRequestView(APIView):
    """Solicita revisão humana para vincular uma conta a um cadastro existente."""

    permission_classes = [IsAuthenticated]
    serializer_class = MemberLinkRequestSerializer

    def get(self, request):
        queryset = MemberLinkRequest.objects.filter(user=request.user, church=request.user.church)
        return Response(MemberLinkRequestSerializer(queryset, many=True).data)

    def post(self, request):
        if get_member_profile(request.user) is not None:
            return Response({"detail": "Esta conta já está vinculada a um cadastro de membro."}, status=status.HTTP_409_CONFLICT)
        pending = MemberLinkRequest.objects.filter(
            user=request.user, church=request.user.church, status=MemberLinkRequest.Status.PENDING,
        ).first()
        if pending:
            return Response(MemberLinkRequestSerializer(pending).data, status=status.HTTP_200_OK)
        candidate = Member.objects.filter(
            church=request.user.church, email__iexact=request.user.email, user__isnull=True,
        ).first()
        link_request = MemberLinkRequest.objects.create(
            church=request.user.church,
            user=request.user,
            requested_email=request.user.email,
            candidate_member=candidate,
        )
        return Response(MemberLinkRequestSerializer(link_request).data, status=status.HTTP_201_CREATED)
