from django.conf import settings
from rest_framework import serializers
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from . import whatsapp


class RequestSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=32)


class VerifySerializer(serializers.Serializer):
    challenge = serializers.UUIDField()
    code = serializers.RegexField(r"^[0-9]{6}$", max_length=6)


class RegisterSerializer(serializers.Serializer):
    proof = serializers.CharField(min_length=40, max_length=100)
    name = serializers.CharField(min_length=3, max_length=150)
    email = serializers.EmailField(max_length=254)


class PublicWhatsAppView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []


class WhatsAppConfigView(PublicWhatsAppView):
    def get(self, request):
        return Response({"enabled": settings.WHATSAPP_AUTH_ENABLED})


def client_ip(request):
    # Only enabled behind the configured Caddy/nginx chain which overwrites it.
    if settings.WHATSAPP_TRUST_CLIENT_IP:
        return request.META.get("HTTP_X_REAL_IP", request.META.get("REMOTE_ADDR", "unknown"))[:64]
    return request.META.get("REMOTE_ADDR", "unknown")


class WhatsAppRequestView(PublicWhatsAppView):
    def post(self, request):
        data = RequestSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        identifier = whatsapp.request_code(data.validated_data["phone"], client_ip(request))
        return Response({"challenge": str(identifier), "expires_in": 300, "resend_in": 60})


class WhatsAppVerifyView(PublicWhatsAppView):
    def post(self, request):
        data = VerifySerializer(data=request.data)
        data.is_valid(raise_exception=True)
        return Response(whatsapp.verify_code(data.validated_data["challenge"], data.validated_data["code"]))


class WhatsAppRegisterView(PublicWhatsAppView):
    def post(self, request):
        data = RegisterSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        return Response(whatsapp.register_account(**data.validated_data), status=201)


class WhatsAppLinkRequestView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        data = RequestSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        identifier = whatsapp.request_code(data.validated_data["phone"], client_ip(request), purpose="link", user=request.user)
        return Response({"challenge": str(identifier), "expires_in": 300, "resend_in": 60})


class WhatsAppLinkVerifyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        data = VerifySerializer(data=request.data)
        data.is_valid(raise_exception=True)
        return Response(whatsapp.verify_code(data.validated_data["challenge"], data.validated_data["code"], request.user))
