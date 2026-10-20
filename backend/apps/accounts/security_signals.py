from django.contrib.auth.signals import user_logged_out
from django.dispatch import receiver
from django.utils import timezone
from .models import AuthSession


@receiver(user_logged_out)
def revoke_admin_session(sender, request, **kwargs):
    sid = request.session.get("moriah_auth_sid") if request else None
    if sid:
        AuthSession.objects.filter(pk=sid, revoked_at__isnull=True).update(revoked_at=timezone.now())
