from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import serializers, viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema

from apps.events.models import ServiceTime
from .models import OnboardingProfile
from .onboarding import complete_personal, personal_state, require_church, save_personal, setup_action, setup_state
from .permissions import is_admin_user


class StrictSerializer(serializers.Serializer):
    def to_internal_value(self, data):
        if not isinstance(data, dict):
            raise ValidationError("Envie um objeto JSON.")
        unknown = set(data) - set(self.fields)
        if unknown:
            raise ValidationError({key: ["Campo não permitido."] for key in unknown})
        return super().to_internal_value(data)


class PersonalSerializer(StrictSerializer):
    name = serializers.CharField(max_length=150, required=False)
    birth_date = serializers.DateField(required=False, allow_null=True)
    relationship = serializers.ChoiceField(choices=OnboardingProfile.Relationship.choices, required=False)
    step = serializers.ChoiceField(choices=("welcome", "profile", "next_steps"), required=False)

    def validate_birth_date(self, value):
        if value and value > timezone.localdate():
            raise serializers.ValidationError("A data não pode estar no futuro.")
        return value


class OnboardingResultSerializer(serializers.Serializer):
    version = serializers.IntegerField()
    journey = serializers.ChoiceField(choices=("personal", "admin"))
    step = serializers.CharField()
    status = serializers.CharField()
    profile = serializers.DictField()
    whatsapp_verified = serializers.BooleanField()
    completed_at = serializers.DateTimeField(allow_null=True)
    member_link = serializers.DictField()
    next_actions = serializers.ListField(child=serializers.DictField())


class SetupResultSerializer(serializers.Serializer):
    completed_count = serializers.IntegerField()
    total_count = serializers.IntegerField()
    percentage = serializers.IntegerField()
    card_visible = serializers.BooleanField()
    items = serializers.ListField(child=serializers.DictField())


class PersonalOnboardingView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = PersonalSerializer

    @extend_schema(responses=OnboardingResultSerializer)
    def get(self, request):
        require_church(request.user)
        return Response(personal_state(request.user))

    @extend_schema(request=PersonalSerializer, responses=OnboardingResultSerializer)
    def patch(self, request):
        data = PersonalSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        return Response(save_personal(request.user, dict(data.validated_data)))


class CompleteOnboardingView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = StrictSerializer

    @extend_schema(request=StrictSerializer, responses=OnboardingResultSerializer)
    def post(self, request):
        data = StrictSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        return Response(complete_personal(request.user))


class ConfirmSerializer(StrictSerializer):
    item = serializers.ChoiceField(choices=("church_review", "team_review"))


class ChurchSetupView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = StrictSerializer

    @extend_schema(responses=SetupResultSerializer)
    def get(self, request):
        return Response(setup_state(request.user))


class ConfirmSetupView(ChurchSetupView):
    serializer_class = ConfirmSerializer
    http_method_names = ["post", "options"]

    @extend_schema(request=ConfirmSerializer, responses=SetupResultSerializer)
    def post(self, request):
        data = ConfirmSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        return Response(setup_action(request.user, item=data.validated_data["item"]))


class DismissSetupView(ChurchSetupView):
    http_method_names = ["post", "options"]
    @extend_schema(request=StrictSerializer, responses=SetupResultSerializer)
    def post(self, request):
        data = StrictSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        return Response(setup_action(request.user, dismiss=True))


class ServiceTimeSerializer(serializers.ModelSerializer):
    time = serializers.TimeField(format="%H:%M", input_formats=("%H:%M",))

    class Meta:
        model = ServiceTime
        fields = ("id", "weekday", "time", "location", "active")
        read_only_fields = ("id",)
        validators = []

    def to_internal_value(self, data):
        if not isinstance(data, dict):
            raise ValidationError("Envie um objeto JSON.")
        unknown = set(data) - {"weekday", "time", "location", "active"}
        if unknown:
            raise ValidationError({key: ["Campo não permitido."] for key in unknown})
        return super().to_internal_value(data)

    def validate(self, attrs):
        values = {key: attrs.get(key, getattr(self.instance, key, None)) for key in ("weekday", "time", "location")}
        query = ServiceTime.objects.filter(church_id=self.context["request"].user.church_id, **values)
        if self.instance:
            query = query.exclude(pk=self.instance.pk)
        if query.exists():
            raise ValidationError("Este horário já está cadastrado.")
        return attrs


class ServiceTimeViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = ServiceTimeSerializer
    queryset = ServiceTime.objects.none()
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    pagination_class = None

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return ServiceTime.objects.none()
        user = self.request.user
        require_church(user)
        admin = is_admin_user(user)
        if self.action not in ("list", "retrieve") and not admin:
            raise PermissionDenied("Apenas a administração pode alterar os horários.")
        include_inactive = self.request.query_params.get("include_inactive") == "true"
        if include_inactive and not admin:
            raise PermissionDenied("Apenas a administração pode consultar horários inativos.")
        query = ServiceTime.objects.filter(church_id=user.church_id)
        return query if include_inactive or self.action not in ("list", "retrieve") else query.filter(active=True)

    def perform_create(self, serializer):
        self.get_queryset()
        self._save(serializer, church_id=self.request.user.church_id)

    def perform_update(self, serializer):
        self._save(serializer)

    def _save(self, serializer, **kwargs):
        try:
            with transaction.atomic():
                serializer.save(**kwargs)
        except IntegrityError:
            raise ValidationError("Este horário já está cadastrado.") from None
