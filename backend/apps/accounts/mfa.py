"""TOTP with encrypted seeds, replay prevention and hashed recovery codes."""
import hmac
import secrets
import uuid
import pyotp
from cryptography.fernet import Fernet
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import AuthenticationFailed, ValidationError
from .models import MFAChallenge, MFAFactor
from .sessions import active, digest, issue_session, needs_mfa


def cipher():
    return Fernet(settings.MFA_ENCRYPTION_KEY.encode())


def locked_challenge(identifier):
    try:
        identifier = uuid.UUID(str(identifier))
    except (ValueError, TypeError):
        raise AuthenticationFailed("Verificação inválida ou expirada.") from None
    challenge = MFAChallenge.objects.select_for_update(of=("self",)).select_related("user__church").filter(pk=identifier).first()
    if (not challenge or challenge.consumed_at or challenge.attempts >= 5 or challenge.expires_at <= timezone.now()
            or not active(challenge.user) or not needs_mfa(challenge.user) or not hmac.compare_digest(challenge.password_digest, digest(challenge.user.password))):
        raise AuthenticationFailed("Verificação inválida ou expirada.")
    return challenge


@transaction.atomic
def enroll(identifier):
    challenge = locked_challenge(identifier)
    factor, _ = MFAFactor.objects.get_or_create(user=challenge.user)
    factor = MFAFactor.objects.select_for_update().get(pk=factor.pk)
    if factor.confirmed_at:
        raise ValidationError("O autenticador já está configurado.")
    # Idempotent within enrollment: repeated requests do not invalidate the QR.
    if not factor.encrypted_secret:
        factor.encrypted_secret = cipher().encrypt(pyotp.random_base32().encode()).decode()
        factor.save(update_fields=["encrypted_secret"])
    secret = cipher().decrypt(factor.encrypted_secret.encode()).decode()
    return {"uri": pyotp.TOTP(secret).provisioning_uri(challenge.user.email, issuer_name="Moriah"), "secret": secret}


def verify_factor(factor, code):
    """Caller holds factor row lock. Returns success; mutates replay state."""
    code = str(code).strip().replace(" ", "")
    if factor.encrypted_secret and code.isdigit() and len(code) == 6:
        totp = pyotp.TOTP(cipher().decrypt(factor.encrypted_secret.encode()).decode())
        counter = int(timezone.now().timestamp()) // totp.interval
        for candidate in (counter - 1, counter, counter + 1):
            if candidate > factor.last_counter and hmac.compare_digest(totp.at(candidate * totp.interval), code):
                factor.last_counter = candidate
                return True
    if factor.confirmed_at:
        for stored in factor.recovery_hashes:
            if hmac.compare_digest(stored, digest(code)):
                factor.recovery_hashes = [item for item in factor.recovery_hashes if item != stored]
                return True
    return False


def verify(identifier, code):
    result = None
    with transaction.atomic():
        challenge = locked_challenge(identifier)
        challenge.attempts += 1
        challenge.save(update_fields=["attempts"])
        factor = MFAFactor.objects.select_for_update().filter(user=challenge.user).first()
        if factor and verify_factor(factor, code):
            recovery = None
            if not factor.confirmed_at:
                factor.confirmed_at = timezone.now()
                recovery = [secrets.token_hex(10) for _ in range(8)]
                factor.recovery_hashes = [digest(item) for item in recovery]
            factor.save()
            challenge.consumed_at = timezone.now()
            challenge.save(update_fields=["consumed_at"])
            result = issue_session(challenge.user, mfa_verified=True)
            if recovery:
                result["recovery_codes"] = recovery
    # Raise outside the transaction so invalid attempts remain committed.
    if result is None:
        raise AuthenticationFailed("Código inválido ou já utilizado.")
    return result


def verify_admin(user, code):
    with transaction.atomic():
        factor = MFAFactor.objects.select_for_update().filter(user=user, confirmed_at__isnull=False).first()
        if factor and verify_factor(factor, code):
            factor.save()
            return True
    return False
