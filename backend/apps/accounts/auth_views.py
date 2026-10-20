from django.conf import settings
from django.contrib.auth import authenticate
from django.middleware.csrf import get_token
from django.utils import timezone
from rest_framework.authentication import CSRFCheck
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

from .models import AuthSession
from .sessions import active, client_ip, issue_session, reserve_attempt, rotate

COOKIE = "moriah_refresh"


class LoginInput(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(max_length=1024, trim_whitespace=False)


class RefreshInput(serializers.Serializer):
    refresh = serializers.CharField(max_length=4096, required=False, allow_blank=True)


class EmptyInput(serializers.Serializer):
    pass


def web_request(request):
    # Cookies also enforce CSRF: removing the client header is no bypass.
    return request.headers.get("X-Moriah-Client") == "web" or bool(request.COOKIES.get(COOKIE))


def enforce_web_csrf(request):
    if web_request(request):
        check = CSRFCheck(lambda req: None)
        check.process_request(request)
        reason = check.process_view(request, None, (), {})
        if reason:
            raise PermissionDenied("Verificação CSRF falhou.")


def token_response(request, data, status=200):
    response = Response({k: v for k, v in data.items() if k != "refresh"} if web_request(request) else data, status=status)
    response["Cache-Control"] = "no-store"
    if web_request(request) and data.get("refresh"):
        token = RefreshToken(data["refresh"])
        response.set_cookie(COOKIE, data["refresh"], max_age=max(0, token["exp"] - int(timezone.now().timestamp())),
                            secure=not settings.DEBUG, httponly=True, samesite="Strict", path="/")
    return response


class PublicAuthView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get_authenticate_header(self, request):
        return 'Bearer realm="api"'


class CSRFView(PublicAuthView):
    serializer_class = EmptyInput
    def get(self, request):
        response = Response({"csrfToken": get_token(request)})
        response["Cache-Control"] = "no-store"
        return response


class LoginView(PublicAuthView):
    serializer_class = LoginInput
    def post(self, request):
        enforce_web_csrf(request)
        data = self.serializer_class(data=request.data)
        data.is_valid(raise_exception=True)
        email = data.validated_data["email"].strip().lower()
        reserve_attempt(email, client_ip(request))
        user = authenticate(request, username=email, password=data.validated_data["password"])
        if not user or not active(user):
            raise AuthenticationFailed("Não foi possível autenticar.")
        return token_response(request, issue_session(user))


class RefreshView(PublicAuthView):
    serializer_class = RefreshInput
    def post(self, request):
        enforce_web_csrf(request)
        data = self.serializer_class(data=request.data)
        data.is_valid(raise_exception=True)
        raw = request.COOKIES.get(COOKIE, "") if web_request(request) else data.validated_data.get("refresh", "")
        return token_response(request, rotate(raw))


class LogoutView(PublicAuthView):
    serializer_class = RefreshInput
    def post(self, request):
        enforce_web_csrf(request)
        data = self.serializer_class(data=request.data)
        data.is_valid(raise_exception=True)
        raw = request.COOKIES.get(COOKIE, "") if web_request(request) else data.validated_data.get("refresh", "")
        sid = None
        try:
            if raw:
                sid = RefreshToken(raw).get("sid")
            else:
                from .sessions import SessionJWTAuthentication
                result = SessionJWTAuthentication().authenticate(request)
                if result:
                    sid = result[1].get("sid")
            if sid:
                AuthSession.objects.filter(pk=sid, revoked_at__isnull=True).update(revoked_at=timezone.now())
        except (TokenError, AuthenticationFailed, ValueError, TypeError):
            pass
        response = Response(status=204)
        response.delete_cookie(COOKIE, path="/", samesite="Strict")
        response["Cache-Control"] = "no-store"
        return response
