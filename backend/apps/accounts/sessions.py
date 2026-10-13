"""Revocable sessions shared by password, WhatsApp, refresh and private media."""
import hashlib
import hmac
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import AuthenticationFailed, Throttled
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

from .models import AuthAttempt, AuthSession, MFAChallenge, User


def digest(value):
    return hmac.new(settings.SECRET_KEY.encode(), str(value).encode(), hashlib.sha256).hexdigest()


def active(user):
    return bool(user.is_active and user.church_id and user.church.active)


def needs_mfa(user):
    return settings.MFA_REQUIRED and bool(user.is_staff or user.is_superuser or user.assigned_roles() - {User.Role.MEMBER})


def client_ip(request):
    # The edge MUST overwrite this header; never parse attacker supplied XFF.
    key = "HTTP_X_REAL_IP" if settings.AUTH_TRUST_CLIENT_IP else "REMOTE_ADDR"
    return request.META.get(key, "unknown")[:64]


def reserve_attempt(account, ip, namespace="login"):
    """Bound work before hashing; DB locks share the budget across workers."""
    now = timezone.now()
    # Lock/check IP first. Once blocked, random account names cannot create
    # unbounded per-account rows. Every caller acquires locks in this order.
    keys = [(digest(f"{namespace}:ip:{ip}"), settings.AUTH_IP_ATTEMPTS),
            (digest(f"{namespace}:account:{account.casefold()}:{ip}"), settings.AUTH_ACCOUNT_ATTEMPTS)]
    blocked = False
    with transaction.atomic():
        for key, limit in keys:
            AuthAttempt.objects.get_or_create(key=key, defaults={"window_started": now})
            row = AuthAttempt.objects.select_for_update().get(key=key)
            if row.window_started + timedelta(seconds=settings.AUTH_WINDOW_SECONDS) <= now:
                row.window_started, row.count = now, 0
            if row.count >= limit:
                blocked = True
            else:
                row.count += 1
            row.save(update_fields=["window_started", "count"])
            if blocked:
                break
    if blocked:
        raise Throttled(wait=settings.AUTH_WINDOW_SECONDS, detail="Muitas tentativas. Aguarde antes de tentar novamente.")


def session_valid(session, user=None):
    user = user or session.user
    return (active(user) and session.user_id == user.pk and session.church_id == user.church_id
            and not session.revoked_at and session.expires_at > timezone.now()
            and hmac.compare_digest(session.password_digest, digest(user.password))
            and (not needs_mfa(user) or session.mfa_verified))


def pair(session):
    refresh = RefreshToken.for_user(session.user)
    refresh["sid"] = str(session.pk)
    refresh["exp"] = int(session.expires_at.timestamp())
    session.refresh_digest = digest(refresh["jti"])
    session.save(update_fields=["refresh_digest"])
    return {"access": str(refresh.access_token), "refresh": str(refresh)}


def create_session(user, *, mfa_verified=False):
    return AuthSession.objects.create(user=user, church_id=user.church_id,
                expires_at=timezone.now() + settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"],
                password_digest=digest(user.password), mfa_verified=mfa_verified)


def issue_session(user, *, mfa_verified=False):
    if not active(user):
        raise AuthenticationFailed("Não foi possível autenticar.")
    if needs_mfa(user) and not mfa_verified:
        challenge = MFAChallenge.objects.create(user=user, password_digest=digest(user.password),
                                                expires_at=timezone.now() + timedelta(minutes=5))
        enrolled = hasattr(user, "mfa_factor") and bool(user.mfa_factor.confirmed_at)
        return {"mfa_required": True, "challenge": str(challenge.pk), "enrollment_required": not enrolled}
    session = create_session(user, mfa_verified=mfa_verified)
    return pair(session)


@transaction.atomic
def rotate(raw):
    try:
        token = RefreshToken(raw)
        session = AuthSession.objects.select_for_update(of=("self",)).select_related("user__church").get(pk=token.get("sid"))
    except (TokenError, AuthSession.DoesNotExist, ValueError, TypeError):
        raise AuthenticationFailed("Sessão inválida ou expirada.") from None
    if (not session_valid(session) or str(token.get("user_id")) != str(session.user_id)
            or not hmac.compare_digest(session.refresh_digest, digest(token["jti"]))):
        raise AuthenticationFailed("Sessão inválida ou expirada.")
    return pair(session)


class SessionJWTAuthentication(JWTAuthentication):
    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        try:
            session = AuthSession.objects.select_related("user__church").get(pk=validated_token.get("sid"), user=user)
        except (AuthSession.DoesNotExist, ValueError, TypeError):
            raise AuthenticationFailed("Sessão inválida ou expirada.") from None
        if not session_valid(session, user):
            raise AuthenticationFailed("Sessão inválida ou expirada.")
        return user
