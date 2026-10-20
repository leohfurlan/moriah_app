import io
import uuid
from decimal import Decimal
from zoneinfo import ZoneInfo
from datetime import timedelta

import qrcode
import qrcode.image.svg
from django.db import transaction
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.pagination import OptionalPaginationMixin
from apps.accounts.permissions import HasMemberProfile, get_member_profile
from . import cora
from .models import Contribution, PixIntent, PixPayer


def today():
    return timezone.localdate(timezone=ZoneInfo("America/Sao_Paulo"))


class PixInput(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("5.00"))
    category = serializers.ChoiceField(choices=Contribution.Category.choices)
    cpf = serializers.CharField(required=False, max_length=18, write_only=True)

    def validate_cpf(self, value):
        return cora.normalize_cpf(value)

    def to_internal_value(self, data):
        unknown = set(data) - set(self.fields)
        if unknown:
            raise serializers.ValidationError({field: "Campo não permitido." for field in unknown})
        return super().to_internal_value(data)



class PixOutput(serializers.Serializer):
    id = serializers.UUIDField()
    state = serializers.ChoiceField(choices=["creating", "ready", "error", "uncertain"])
    amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    category = serializers.ChoiceField(choices=Contribution.Category.choices)
    due_date = serializers.DateField()
    past_due = serializers.BooleanField()
    recipient_name = serializers.CharField()
    provider_status = serializers.CharField(allow_null=True)
    contribution_id = serializers.IntegerField(allow_null=True)
    error_code = serializers.CharField(allow_null=True)
    emv = serializers.CharField(allow_null=True, required=False)
    qr_svg = serializers.CharField(allow_null=True, required=False)


class PixConfigOutput(serializers.Serializer):
    enabled = serializers.BooleanField()
    has_saved_cpf = serializers.BooleanField()
    cpf_suffix = serializers.CharField(allow_null=True)


def representation(intent, detail=True):
    past_due = intent.due_date < today()
    result = {
        "id": str(intent.pk), "state": intent.state,
        "amount": str(intent.amount), "category": intent.category,
        "due_date": intent.due_date.isoformat(), "past_due": past_due,
        "recipient_name": intent.recipient_name,
        "provider_status": intent.provider_status or None,
        "contribution_id": intent.contribution_id,
        "error_code": intent.error_code or None,
    }
    if detail:
        result["emv"] = intent.emv if intent.state == "ready" and not past_due else None
        result["qr_svg"] = None
        if result["emv"]:
            image = qrcode.make(intent.emv, image_factory=qrcode.image.svg.SvgPathImage)
            output = io.BytesIO()
            image.save(output)
            result["qr_svg"] = output.getvalue().decode()
    return result


class PixMemberPermission(HasMemberProfile):
    def has_permission(self, request, view):
        return super().has_permission(request, view) and get_member_profile(request.user).church_id == request.user.church_id


class PixIntentViewSet(OptionalPaginationMixin, viewsets.GenericViewSet):
    permission_classes = [PixMemberPermission]
    lookup_value_regex = r"[0-9a-fA-F-]{36}"
    serializer_class = PixOutput
    queryset = PixIntent.objects.none()

    def get_queryset(self):
        return PixIntent.objects.filter(church=self.request.user.church, member=get_member_profile(self.request.user))

    @extend_schema(responses=PixConfigOutput)
    @action(detail=False, methods=["get"])
    def config(self, request):
        payer = PixPayer.objects.filter(church=request.user.church, member=get_member_profile(request.user)).first()
        return Response({"enabled": cora.configured(request.user.church_id), "has_saved_cpf": bool(payer), "cpf_suffix": cora.decrypt_cpf(payer.cpf_encrypted)[-2:] if payer and cora.configured(request.user.church_id) else None})

    def list(self, request):
        # Retomada privada sem EMV/documentos; paginação padrão quando solicitada.
        queryset = self.get_queryset()
        page = self.paginate_queryset(queryset)
        if page is not None:
            return self.get_paginated_response([representation(item, False) for item in page])
        return Response([representation(item, False) for item in queryset[:50]])

    def retrieve(self, request, pk=None):
        return Response(representation(self.get_object()))

    @extend_schema(request=PixInput, responses={201: PixOutput, 200: PixOutput, 202: PixOutput})
    def create(self, request):
        member = get_member_profile(request.user)
        if not cora.configured(request.user.church_id):
            return Response({"code": "pix_disabled", "detail": "Pix indisponível nesta igreja. Você pode enviar um comprovante."}, status=503)
        try:
            key = uuid.UUID(request.headers.get("Idempotency-Key", ""))
        except (ValueError, AttributeError):
            raise serializers.ValidationError({"Idempotency-Key": "Informe um UUID válido."})
        serializer = PixInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        # Serializa criação por membro, incluindo primeira emissão (não há linha de intenção ainda).
        with transaction.atomic():
            type(member).objects.select_for_update().get(pk=member.pk)
            intent = self.get_queryset().filter(request_key=key).first()
            if intent:
                if intent.amount != data["amount"] or intent.category != data["category"] or (data.get("cpf") and cora.decrypt_cpf(intent.cpf_encrypted) != data["cpf"]):
                    return Response({"code": "idempotency_conflict", "detail": "Esta tentativa já possui outros dados."}, status=409)
                # Nunca reenvia automaticamente uma operação de resultado incerto.
                return Response(representation(intent), status=200 if intent.state == "ready" else 202)
            name = member.full_name.strip()
            if not name or len(name) > 60:
                raise serializers.ValidationError({"name": "O nome do pagador deve ter entre 1 e 60 caracteres. Regularize seu cadastro."})
            payer = PixPayer.objects.filter(church=request.user.church, member=member).first()
            cpf = data.get("cpf") or (cora.decrypt_cpf(payer.cpf_encrypted) if payer else None)
            if not cpf:
                raise serializers.ValidationError({"cpf": "Informe o CPF de quem fará a contribuição."})
            encrypted = cora.encrypt_cpf(cpf)
            PixPayer.objects.update_or_create(member=member, defaults={"church": request.user.church, "cpf_encrypted": encrypted})
            from django.conf import settings
            intent = PixIntent.objects.create(church=request.user.church, member=member, request_key=key,
                amount=data["amount"], category=data["category"], due_date=today(),
                environment=settings.CORA_ENVIRONMENT, recipient_name=settings.CORA_RECIPIENT_NAME,
                payer_name=name, cpf_encrypted=encrypted)
        return self.issue(intent)

    @extend_schema(request=None, responses={200: PixOutput, 201: PixOutput, 202: PixOutput})
    @action(detail=True, methods=["post"])
    def retry(self, request, pk=None):
        from django.conf import settings
        if not cora.configured(request.user.church_id):
            return Response({"code": "pix_disabled", "detail": "Pix indisponível."}, status=503)
        with transaction.atomic():
            intent = self.get_queryset().select_for_update().filter(pk=pk).first()
            if intent is None:
                from rest_framework.exceptions import NotFound
                raise NotFound()
            if intent.state == "ready":
                return Response(representation(intent))
            if intent.due_date < today() or intent.environment != settings.CORA_ENVIRONMENT:
                return Response({"detail": "Não é possível repetir esta emissão. Solicite verificação à tesouraria."}, status=409)
            if intent.state == "creating" and intent.updated_at > timezone.now() - timedelta(minutes=2):
                return Response(representation(intent), status=202)
            intent.state, intent.error_code = "creating", ""
            intent.save(update_fields=["state", "error_code", "updated_at"])
        return self.issue(intent)

    @staticmethod
    def issue(intent):
        try:
            result = cora.issue_pix(intent)
            emv = result.get("pix", {}).get("emv")
            if not isinstance(emv, str) or not emv or len(emv) > 1024 or not isinstance(result.get("id"), str) or not result["id"] or len(result["id"]) > 255 or result.get("total_amount") != int(intent.amount * 100) or result.get("status") not in {"OPEN", "DRAFT", "IN_PAYMENT", "PAID"}:
                raise ValueError("invalid response")
            intent.emv, intent.provider_id, intent.provider_status = emv, result["id"], result["status"]
            intent.state = "ready"
        except cora.CoraRejected:
            intent.state, intent.error_code = "error", "cora_rejected"
        except (cora.CoraUnavailable, ValueError, TypeError, AttributeError):
            intent.state, intent.error_code = "uncertain", "cora_unavailable"
        intent.save()
        from apps.audit.models import AuditLog
        from apps.audit.middleware import get_current_user
        AuditLog.objects.create(church=intent.church, user=get_current_user(),
            action="pix_intent_updated", model_name="PixIntent", object_id=str(intent.pk),
            payload={"state": intent.state, "error_code": intent.error_code})
        return Response(representation(intent), status=201 if intent.state == "ready" else 202)
