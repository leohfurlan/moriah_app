"""Administrative app registrations, always scoped to the authenticated church."""
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from rest_framework import serializers, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.cells.models import Cell
from apps.events.models import Event
from apps.ministries.models import Ministry
from .admin_site import OWNER_EMAIL
from .models import Church, User, UserRoleAssignment
from .onboarding import require_church
from .permissions import is_admin_user


def record_change(request, instance, action, fields):
    from apps.audit.models import AuditLog
    AuditLog.objects.create(church_id=request.user.church_id, user=request.user,
                            action=action, model_name=instance._meta.label,
                            object_id=str(instance.pk), payload={"fields": sorted(set(fields) - {"password"})})


class ManageChurch(BasePermission):
    def has_permission(self, request, view):
        return is_admin_user(request.user) and bool(request.user.church_id)


class StrictFieldsMixin:
    def to_internal_value(self, data):
        if not isinstance(data, dict):
            raise ValidationError("Envie um objeto JSON.")
        allowed = {name for name, field in self.fields.items() if not field.read_only}
        unknown = set(data) - allowed
        if unknown:
            raise ValidationError({name: "Campo não permitido." for name in unknown})
        return super().to_internal_value(data)


class ChurchSerializer(StrictFieldsMixin, serializers.ModelSerializer):
    class Meta:
        model = Church
        fields = ("id", "name", "legal_name", "tax_id", "city", "state")
        read_only_fields = ("id",)

    def validate_state(self, value):
        states = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split()
        value = value.upper()
        if value and value not in states:
            raise ValidationError("Informe uma UF válida.")
        return value


class ChurchDetailsView(APIView):
    permission_classes = [IsAuthenticated, ManageChurch]
    serializer_class = ChurchSerializer

    def get(self, request):
        return Response(self.serializer_class(request.user.church).data)

    @transaction.atomic
    def patch(self, request):
        church = Church.objects.select_for_update().get(pk=request.user.church_id)
        serializer = self.serializer_class(church, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        record_change(request, church, "church_details_updated", serializer.validated_data)
        return Response(serializer.data)


class RegistrationOptionsSerializer(serializers.Serializer):
    users = serializers.ListField(child=serializers.DictField())
    members = serializers.ListField(child=serializers.DictField())
    roles = serializers.ListField(child=serializers.DictField())
    event_types = serializers.ListField(child=serializers.DictField())


class RegistrationOptionsView(APIView):
    permission_classes = [IsAuthenticated, ManageChurch]
    serializer_class = RegistrationOptionsSerializer

    def get(self, request):
        from apps.members.models import Member
        return Response({
            "users": [{"id": user.pk, "name": user.get_full_name() or user.email}
                      for user in User.objects.filter(church_id=request.user.church_id, is_active=True).order_by("first_name", "pk")],
            "members": list(Member.objects.filter(church_id=request.user.church_id).order_by("full_name", "pk").values("id", "full_name")),
            "roles": [{"value": value, "label": label} for value, label in User.Role.choices],
            "event_types": [{"value": value, "label": label} for value, label in Event.EventType.choices],
        })


class RegistrationTeamSerializer(StrictFieldsMixin, serializers.ModelSerializer):
    name = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, required=False, trim_whitespace=False)
    additional_roles = serializers.ListField(child=serializers.ChoiceField(choices=User.Role.choices), required=False)
    protected = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ("id", "name", "email", "role", "additional_roles", "is_active", "password", "protected")
        read_only_fields = ("id", "protected")
        extra_kwargs = {"email": {"validators": []}}

    def get_protected(self, user) -> bool:
        return user.email.casefold() == OWNER_EMAIL or user.is_superuser

    def to_representation(self, user):
        # `name` and the composed roles are explicit API fields, not model attributes.
        data = {"id": user.pk, "name": user.get_full_name(), "email": user.email,
                "role": user.role, "additional_roles": list(user.role_assignments.values_list("role", flat=True)),
                "is_active": user.is_active, "protected": self.get_protected(user)}
        return data

    def validate(self, attrs):
        if self.instance and (self.get_protected(self.instance) or self.instance.pk == self.context["request"].user.pk):
            raise ValidationError("A conta responsável e sua própria conta não podem ser alteradas nesta tela.")
        if self.instance and ("email" in attrs or "password" in attrs):
            raise ValidationError("E-mail e senha não podem ser alterados nesta tela.")
        email = attrs.get("email", "").strip().lower()
        if not self.instance:
            if email == OWNER_EMAIL or User.objects.filter(email__iexact=email).exists():
                raise ValidationError({"email": "Este e-mail não está disponível."})
            attrs["email"] = email
            if not attrs.get("password"):
                raise ValidationError({"password": "Defina uma senha inicial."})
            first, _, last = attrs.get("name", "").partition(" ")
            try:
                validate_password(attrs["password"], User(email=email, username=email, first_name=first, last_name=last))
            except DjangoValidationError as error:
                raise ValidationError({"password": error.messages}) from None
        return attrs

    def create(self, values):
        name = values.pop("name"); roles = values.pop("additional_roles", [])
        first, _, last = name.strip().partition(" ")
        user = User.objects.create_user(username=values["email"], first_name=first, last_name=last, **values)
        for role in set(roles) - {user.role}:
            UserRoleAssignment.objects.create(user=user, role=role)
        return user

    def update(self, user, values):
        self.validate(values)
        name = values.pop("name", None); roles = values.pop("additional_roles", None)
        if name is not None:
            user.first_name, _, user.last_name = name.strip().partition(" ")
        for field, value in values.items():
            setattr(user, field, value)
        user.save()
        if roles is not None:
            user.role_assignments.all().delete()
            for role in set(roles) - {user.role}:
                UserRoleAssignment.objects.create(user=user, role=role)
        return user


class ScopedRegistrationViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, ManageChurch]
    pagination_class = None
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return self.queryset.none()
        require_church(self.request.user)
        return self.queryset.filter(church_id=self.request.user.church_id).order_by("pk")

    def perform_create(self, serializer):
        try:
            with transaction.atomic():
                Church.objects.select_for_update().get(pk=self.request.user.church_id)
                instance = serializer.save(church_id=self.request.user.church_id)
                record_change(self.request, instance, "registration_created", serializer.validated_data)
        except IntegrityError:
            raise ValidationError("Já existe um cadastro com estes dados. Atualize a lista e confira os campos.") from None

    def perform_update(self, serializer):
        with transaction.atomic():
            Church.objects.select_for_update().get(pk=self.request.user.church_id)
            # Serialize writes to team roles and the shared church setup state.
            serializer.instance = self.get_queryset().select_for_update().get(pk=serializer.instance.pk)
            instance = serializer.save()
            record_change(self.request, instance, "registration_updated", serializer.validated_data)


class TeamViewSet(ScopedRegistrationViewSet):
    queryset = User.objects.all()
    serializer_class = RegistrationTeamSerializer


class ScopedRelationsMixin:
    def get_fields(self):
        fields = super().get_fields()
        request = self.context.get("request")
        church_id = request.user.church_id if request and request.user.is_authenticated else None
        for name in self.scoped_relations:
            field = fields[name]
            relation = field.child_relation if hasattr(field, "child_relation") else field
            relation.queryset = relation.queryset.filter(church_id=church_id)
        return fields


class RegistrationCellSerializer(ScopedRelationsMixin, StrictFieldsMixin, serializers.ModelSerializer):
    scoped_relations = ("leader", "assistant_leader")

    class Meta:
        model = Cell
        fields = ("id", "name", "leader", "assistant_leader", "meeting_day", "meeting_time", "location", "notes")
        read_only_fields = ("id",)


class CellViewSet(ScopedRegistrationViewSet):
    queryset = Cell.objects.all()
    serializer_class = RegistrationCellSerializer


class RegistrationMinistrySerializer(ScopedRelationsMixin, StrictFieldsMixin, serializers.ModelSerializer):
    scoped_relations = ("members", "coordinators")
    coordinators = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), many=True, required=False)

    class Meta:
        model = Ministry
        fields = ("id", "name", "description", "members", "coordinators")
        read_only_fields = ("id",)


class MinistryViewSet(ScopedRegistrationViewSet):
    queryset = Ministry.objects.all()
    serializer_class = RegistrationMinistrySerializer


class RegistrationEventSerializer(StrictFieldsMixin, serializers.ModelSerializer):
    class Meta:
        model = Event
        fields = ("id", "name", "event_type", "start_at", "end_at", "location", "description", "active")
        read_only_fields = ("id",)

    def validate(self, attrs):
        start = attrs.get("start_at", getattr(self.instance, "start_at", None))
        end = attrs.get("end_at", getattr(self.instance, "end_at", None))
        if start and end and end < start:
            raise ValidationError({"end_at": "O término deve ser posterior ao início."})
        return attrs


class EventViewSet(ScopedRegistrationViewSet):
    queryset = Event.objects.all()
    serializer_class = RegistrationEventSerializer
