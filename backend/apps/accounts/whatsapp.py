"""WhatsApp authentication, with locked one-use codes and verified identities."""
import hashlib
import hmac
import json
import re
import secrets
from datetime import timedelta
from urllib.parse import quote
from urllib.request import Request, build_opener, HTTPRedirectHandler

from django.conf import settings
from django.db import transaction, IntegrityError
from django.utils import timezone
from rest_framework.exceptions import APIException, ValidationError, Throttled
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Church, User, WhatsAppIdentity, WhatsAppChallenge, WhatsAppSendLimit


class ProviderUnavailable(APIException):
    status_code = 503
    default_detail = "Não foi possível enviar o código. Tente mais tarde ou entre com e-mail e senha."


def normalize_phone(value):
    if not isinstance(value, str) or len(value) > 32 or re.search(r"[^0-9+ ()-]", value):
        raise ValidationError({"phone": "Informe seu WhatsApp com DDD."})
    phone = re.sub(r"\D", "", value)
    if len(phone) in (10, 11):
        phone = "55" + phone
    ddds = {11,12,13,14,15,16,17,18,19,21,22,24,27,28,31,32,33,34,35,37,38,41,42,43,44,45,46,47,48,49,51,53,54,55,61,62,63,64,65,66,67,68,69,71,73,74,75,77,79,81,82,83,84,85,86,87,88,89,91,92,93,94,95,96,97,98,99}
    if len(phone) not in (12, 13) or not phone.startswith("55") or int(phone[2:4]) not in ddds or phone[4] != "9":
        raise ValidationError({"phone": "Use um celular brasileiro válido com DDD."})
    return "+" + phone


def digest(value):
    return hmac.new(settings.SECRET_KEY.encode(), ("moriah.otp.v1:" + value).encode(), hashlib.sha256).hexdigest()


def configured_church():
    if not settings.WHATSAPP_AUTH_ENABLED:
        raise ProviderUnavailable()
    church = Church.objects.filter(pk=settings.WHATSAPP_AUTH_CHURCH_ID, active=True).first()
    if not church:
        raise ProviderUnavailable()
    return church


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def send_code(phone, code):
    if not all((settings.EVOLUTION_API_URL, settings.EVOLUTION_API_KEY, settings.EVOLUTION_INSTANCE)):
        raise ProviderUnavailable()
    url = settings.EVOLUTION_API_URL.rstrip("/") + "/message/sendText/" + quote(settings.EVOLUTION_INSTANCE, safe="")
    payload = {"number": phone.lstrip("+"), "text": f"Seu código de acesso ao Moriah é {code}. Válido por 5 minutos. Não compartilhe este código."}
    request = Request(url, data=json.dumps(payload).encode(), headers={"Content-Type": "application/json", "apikey": settings.EVOLUTION_API_KEY})
    try:
        with build_opener(NoRedirect).open(request, timeout=10) as response:
            result = json.loads(response.read(65537))
            if response.status not in (200, 201) or not result.get("key", {}).get("id"):
                raise ProviderUnavailable()
    except Exception:
        # Never include provider body, API key, number or OTP in logs/errors.
        raise ProviderUnavailable() from None


def reserve_send(phone, ip, church):
    now = timezone.now()
    limits = [(digest(f"phone:{church.pk}:{phone}"), 5, 60), (digest(f"ip:{ip}"), 20, 0), (digest("global"), 100, 0)]
    with transaction.atomic():
        for key, maximum, cooldown in sorted(limits):
            WhatsAppSendLimit.objects.get_or_create(key=key, defaults={"window_started": now})
            bucket = WhatsAppSendLimit.objects.select_for_update().get(key=key)
            if bucket.window_started <= now - timedelta(hours=1):
                bucket.count = 0
                bucket.window_started = now
            if bucket.count >= maximum:
                raise Throttled(wait=max(1, int((bucket.window_started + timedelta(hours=1) - now).total_seconds())))
            if cooldown and bucket.last_sent and bucket.last_sent > now - timedelta(seconds=cooldown):
                raise Throttled(wait=max(1, int((bucket.last_sent + timedelta(seconds=cooldown) - now).total_seconds())))
            bucket.count += 1
            bucket.last_sent = now
            bucket.save()


def request_code(phone, ip, purpose="login", user=None):
    church = configured_church()
    phone = normalize_phone(phone)
    if purpose == "link" and (not user or not user.is_active or user.church_id != church.pk):
        raise ValidationError("Entre na sua conta para vincular o WhatsApp.")
    reserve_send(phone, ip, church)
    code = f"{secrets.randbelow(1_000_000):06d}"
    challenge = WhatsAppChallenge(church=church, phone=phone, purpose=purpose, user=user if purpose == "link" else None, expires_at=timezone.now()+timedelta(minutes=5))
    challenge.code_digest = digest(f"{challenge.pk}:{code}")
    challenge.save()
    try:
        send_code(phone, code)
    except Exception:
        challenge.delete()
        raise ProviderUnavailable() from None
    challenge.sent = True
    challenge.save(update_fields=("sent",))
    # The latest successfully sent challenge supersedes previous unconsumed ones.
    WhatsAppChallenge.objects.filter(church=church, phone=phone, consumed_at=None).exclude(pk=challenge.pk).update(consumed_at=timezone.now())
    return challenge.pk


def tokens_for(user):
    if not user.is_active or not user.church_id or not user.church.active:
        raise ValidationError("Não foi possível acessar esta conta. Procure a secretaria.")
    refresh = RefreshToken.for_user(user)
    return {"access": str(refresh.access_token), "refresh": str(refresh)}


def verify_code(identifier, code, user=None):
    church = configured_church()
    now = timezone.now()
    result = None
    with transaction.atomic():
        challenge = WhatsAppChallenge.objects.select_for_update().filter(pk=identifier, church=church).first()
        if not challenge or not challenge.sent or challenge.consumed_at or challenge.verified_at or challenge.expires_at <= now or challenge.attempts >= 5:
            raise ValidationError("Código inválido ou expirado. Solicite outro código.")
        if challenge.purpose == "link" and (not user or user.pk != challenge.user_id or user.church_id != church.pk):
            raise ValidationError("Esta validação pertence a outra sessão.")
        challenge.attempts += 1
        if hmac.compare_digest(challenge.code_digest, digest(f"{challenge.pk}:{code}")):
            challenge.verified_at = now
            if challenge.purpose == "link":
                try:
                    with transaction.atomic():
                        identity, _ = WhatsAppIdentity.objects.get_or_create(user=user, defaults={"phone": challenge.phone, "church": church})
                        if identity.church_id != church.pk:
                            raise ValidationError("Este vínculo pertence a outra igreja. Procure a secretaria.")
                        identity.phone = challenge.phone
                        identity.save()
                        User.objects.filter(pk=user.pk).update(phone=challenge.phone)
                except IntegrityError:
                    raise ValidationError("Este WhatsApp já está vinculado. Entre pela conta correspondente.") from None
                challenge.consumed_at = now
                result = {"linked": True}
            else:
                identity = WhatsAppIdentity.objects.select_related("user", "user__church").filter(church=church, phone=challenge.phone).first()
                if identity:
                    if identity.user.church_id != church.pk:
                        raise ValidationError("Não foi possível acessar esta conta. Procure a secretaria.")
                    result = tokens_for(identity.user)
                    challenge.consumed_at = now
                else:
                    proof = secrets.token_urlsafe(32)
                    challenge.proof_digest = digest(proof)
                    challenge.proof_expires_at = now + timedelta(minutes=10)
                    result = {"registration_required": True, "proof": proof}
        challenge.save()
    # Fail outside atomic so failed attempts are actually committed.
    if result is None:
        raise ValidationError("Código inválido ou expirado. Solicite outro código.")
    return result


def register_account(proof, name, email):
    from apps.members.models import Member
    church = configured_church()
    now = timezone.now()
    try:
        with transaction.atomic():
            challenge = WhatsAppChallenge.objects.select_for_update().filter(church=church, proof_digest=digest(proof), purpose="login").first()
            if not challenge or not challenge.verified_at or challenge.consumed_at or not challenge.proof_expires_at or challenge.proof_expires_at <= now:
                raise ValidationError("Validação expirada. Verifique seu WhatsApp novamente.")
            if User.objects.filter(email__iexact=email).exists():
                raise ValidationError({"email": "Este e-mail já possui uma conta. Entre com e-mail e senha e vincule o WhatsApp no perfil."})
            if WhatsAppIdentity.objects.filter(church=church, phone=challenge.phone).exists():
                raise ValidationError("Este WhatsApp já possui uma conta. Solicite outro código para entrar.")
            # Never claim an existing user/member solely from unverified email/contact.
            first, _, last = name.strip().partition(" ")
            user = User.objects.create_user(username="wa_"+secrets.token_hex(16), email=email.lower(), password=None,
                first_name=first, last_name=last, church=church, role=User.Role.MEMBER, phone=challenge.phone)
            Member.objects.create(church=church, user=user, full_name=name.strip(), email=email.lower(), phone=challenge.phone, status=Member.Status.VISITOR)
            WhatsAppIdentity.objects.create(church=church, user=user, phone=challenge.phone)
            challenge.consumed_at = now
            challenge.save(update_fields=("consumed_at",))
            return tokens_for(user)
    except IntegrityError:
        raise ValidationError("Já existe uma conta com esses dados. Entre ou procure a secretaria.") from None
