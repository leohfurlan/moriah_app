from .auth_views import PublicAuthView, enforce_web_csrf, token_response
from . import mfa
from rest_framework import serializers


class MFAInput(serializers.Serializer):
    challenge = serializers.UUIDField()
    code = serializers.CharField(max_length=40, required=False, allow_blank=True)


class MFAEnrollView(PublicAuthView):
    serializer_class = MFAInput
    def post(self, request):
        enforce_web_csrf(request)
        data = self.serializer_class(data=request.data)
        data.is_valid(raise_exception=True)
        return token_response(request, mfa.enroll(data.validated_data["challenge"]))


class MFAVerifyView(PublicAuthView):
    serializer_class = MFAInput
    def post(self, request):
        enforce_web_csrf(request)
        data = self.serializer_class(data=request.data)
        data.is_valid(raise_exception=True)
        return token_response(request, mfa.verify(data.validated_data["challenge"], data.validated_data.get("code", "")))
