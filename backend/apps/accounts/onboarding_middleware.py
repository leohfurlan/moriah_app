"""Enforce onboarding on custom DRF permissions and Django Admin."""
from django.conf import settings
from django.http import JsonResponse, HttpResponseRedirect
from rest_framework.exceptions import APIException
from rest_framework_simplejwt.authentication import JWTAuthentication
from .models import OnboardingProfile


class OnboardingMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if not getattr(settings, "ONBOARDING_REQUIRED", True):
            return self.get_response(request)
        path = request.path_info
        if path.startswith("/admin/") and path not in ("/admin/login/", "/admin/logout/"):
            if request.user.is_authenticated and not self.complete(request.user):
                return HttpResponseRedirect("/onboarding")
        base = next((p for p in ("/api/", "/backend/", "/local-api/") if path.startswith(p)), None)
        if base:
            route = path[len(base):]
            allowed = route in ("me/", "me/onboarding/", "me/onboarding/complete/", "schema/", "docs/") or route.startswith("auth/")
            if not allowed:
                try:
                    authenticated = JWTAuthentication().authenticate(request)
                except APIException:
                    authenticated = None
                if authenticated and not self.complete(authenticated[0]):
                    return JsonResponse({"code": "onboarding_required", "detail": "Complete seu perfil para continuar."}, status=403)
        return self.get_response(request)

    @staticmethod
    def complete(user):
        return bool(user.church_id and OnboardingProfile.objects.filter(user=user, completed_at__isnull=False).exists())
