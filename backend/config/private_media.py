"""Temporary, purpose-limited links for files kept on the private VPS volume."""
import mimetypes
from urllib.parse import urlencode

from django.conf import settings
from django.core import signing
from django.http import FileResponse, Http404
from django.forms import ClearableFileInput
from django.shortcuts import get_object_or_404
from django.urls import reverse
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.accounts.permissions import get_member_profile, user_capabilities
from apps.events.models import EventAnnouncement
from apps.finance.models import ContributionAttachment

SALT = "moriah.private-media.v1"


def private_file_url(request, kind, obj):
    if request is None or not request.user.is_authenticated:
        return None
    token = signing.dumps({"kind": kind, "id": obj.pk, "user": request.user.pk}, salt=SALT)
    path = reverse("private-media", kwargs={"kind": kind, "pk": obj.pk})
    return request.build_absolute_uri(path + "?" + urlencode({"token": token}))


class PrivateMediaWidget(ClearableFileInput):
    """Keep Django Admin's existing-file link inside the private download path."""
    def __init__(self, request, kind, **kwargs):
        super().__init__(**kwargs)
        self.request, self.kind = request, kind

    def get_context(self, name, value, attrs):
        context = super().get_context(name, value, attrs)
        if (settings.PRIVATE_LOCAL_MEDIA and not settings.USE_S3_STORAGE and value
                and getattr(value, "instance", None) and value.instance.pk):
            class DisplayFile:
                url = private_file_url(self.request, self.kind, value.instance)

                def __str__(self):
                    return str(value)
            context["widget"]["value"] = DisplayFile()
        return context


class PrivateMediaView(APIView):
    # The signed URL is a bearer capability for one file, like an S3 signed URL.
    # Recheck the issuing user's current status and access on every download.
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request, kind, pk):
        if not settings.PRIVATE_LOCAL_MEDIA or settings.USE_S3_STORAGE:
            raise Http404
        try:
            payload = signing.loads(
                request.query_params.get("token", ""), salt=SALT,
                max_age=settings.LOCAL_MEDIA_URL_EXPIRE_SECONDS,
            )
        except signing.BadSignature:
            raise Http404
        if not isinstance(payload, dict) or payload.get("kind") != kind or payload.get("id") != pk:
            raise Http404
        user = get_object_or_404(User, pk=payload.get("user"), is_active=True)
        if getattr(settings, "ONBOARDING_REQUIRED", True):
            from apps.accounts.onboarding_middleware import OnboardingMiddleware
            if not OnboardingMiddleware.complete(user):
                raise Http404
        capabilities = set(user_capabilities(user))
        if kind == "contribution":
            obj = get_object_or_404(
                ContributionAttachment.objects.select_related("contribution"),
                pk=pk, contribution__church_id=user.church_id,
            )
            member = get_member_profile(user)
            if not (capabilities.intersection({"manage_all", "manage_finance"}) or
                    (member and member.pk == obj.contribution.member_id)):
                raise Http404
            field, name, attachment = obj.file, obj.original_name, True
        elif kind == "announcement":
            obj = get_object_or_404(EventAnnouncement, pk=pk, church_id=user.church_id)
            manager = bool(capabilities.intersection({"manage_all", "manage_events"}))
            if not (manager or (obj.active and "member" in capabilities)):
                raise Http404
            field, name, attachment = obj.image, obj.image.name.rsplit("/", 1)[-1], False
        else:
            raise Http404
        try:
            stream = field.open("rb")
        except (FileNotFoundError, ValueError):
            raise Http404
        response = FileResponse(
            stream, as_attachment=attachment, filename=name,
            content_type=mimetypes.guess_type(name)[0] or "application/octet-stream",
        )
        response["Cache-Control"] = "private, no-store"
        response["Referrer-Policy"] = "no-referrer"
        response["X-Content-Type-Options"] = "nosniff"
        return response
