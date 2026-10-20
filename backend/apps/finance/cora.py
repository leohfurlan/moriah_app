"""Cora Integração Direta. Somente autenticação e emissão Pix, sem baixa automática."""
import json
import re
import ssl
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, build_opener, HTTPSHandler, HTTPRedirectHandler

from cryptography.fernet import Fernet
from django.conf import settings
from rest_framework.exceptions import ValidationError


class CoraUnavailable(Exception):
    pass


class CoraRejected(Exception):
    pass


def normalize_cpf(value):
    if not isinstance(value, str) or re.search(r"[^0-9.\-\s]", value):
        raise ValidationError({"cpf": "Informe um CPF válido."})
    cpf = re.sub(r"[.\-\s]", "", value)
    if len(cpf) != 11 or len(set(cpf)) == 1:
        raise ValidationError({"cpf": "Informe um CPF válido."})
    for length in (9, 10):
        check = (sum(int(cpf[i]) * (length + 1 - i) for i in range(length)) * 10 % 11) % 10
        if check != int(cpf[length]):
            raise ValidationError({"cpf": "Informe um CPF válido."})
    return cpf


def cipher():
    return Fernet(settings.CORA_DATA_KEY.encode())


def encrypt_cpf(value):
    return cipher().encrypt(value.encode()).decode()


def decrypt_cpf(value):
    return cipher().decrypt(value.encode()).decode()


def enabled(church_id):
    return bool(settings.CORA_ENABLED and church_id == settings.CORA_CHURCH_ID)


def configured(church_id):
    if not enabled(church_id):
        return False
    try:
        cipher()
    except (ValueError, TypeError):
        return False
    return all((settings.CORA_CLIENT_ID, settings.CORA_CERT_PATH, settings.CORA_KEY_PATH, settings.CORA_RECIPIENT_NAME)) and settings.CORA_ENVIRONMENT in {"stage", "production"}


class NoRedirect(HTTPRedirectHandler):
    # Nunca encaminhar Bearer/documento para host recebido em redirecionamento.
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def issue_pix(intent):
    base = settings.CORA_BASE_URL.rstrip("/")
    allowed = {
        "stage": "https://matls-clients.api.stage.cora.com.br",
        "production": "https://matls-clients.api.cora.com.br",
    }
    if base != allowed.get(intent.environment):
        raise CoraUnavailable()
    try:
        context = ssl.create_default_context()
        context.load_cert_chain(settings.CORA_CERT_PATH, settings.CORA_KEY_PATH)
        opener = build_opener(HTTPSHandler(context=context), NoRedirect())
        token_request = Request(base + "/token", data=urlencode({"grant_type": "client_credentials", "client_id": settings.CORA_CLIENT_ID}).encode(), headers={"Content-Type": "application/x-www-form-urlencoded"})
        with opener.open(token_request, timeout=20) as response:
            token = json.load(response)["access_token"]
        payload = {
            "code": str(intent.pk),
            "customer": {"name": intent.payer_name, "document": {"identity": decrypt_cpf(intent.cpf_encrypted), "type": "CPF"}},
            "services": [{"name": "Contribuicao", "description": "Contribuicao voluntaria", "amount": int(intent.amount * 100)}],
            "payment_terms": {"due_date": intent.due_date.isoformat()},
            "payment_forms": ["PIX"],
        }
        request = Request(base + "/v2/invoices/", data=json.dumps(payload).encode(), headers={"Content-Type": "application/json", "Accept": "application/json", "Authorization": "Bearer " + token, "Idempotency-Key": str(intent.provider_key)})
        try:
            with opener.open(request, timeout=20) as response:
                return json.load(response)
        except HTTPError as exc:
            if exc.code in {400, 415}:
                raise CoraRejected() from None
            raise CoraUnavailable() from None
    except (OSError, URLError, ValueError, KeyError, TypeError):
        raise CoraUnavailable() from None
