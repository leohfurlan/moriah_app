"""Minimal, church-scoped directory for the supervision console."""
import os
import re
import secrets

from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Church, WhatsAppIdentity


class Talk2meContactsView(APIView):
    authentication_classes = []
    permission_classes = []
    throttle_classes = []

    def post(self, request):
        token = os.environ.get("TALK2ME_DIRECTORY_TOKEN", "")
        scope = os.environ.get("TALK2ME_DIRECTORY_CHURCH_ID", "")
        supplied = request.headers.get("Authorization", "")
        if len(token) < 32 or not secrets.compare_digest(supplied.encode(), ("Bearer " + token).encode()):
            return Response({"detail": "Não autorizado"}, status=401)
        if not scope.isdecimal() or not Church.objects.filter(pk=int(scope), active=True).exists():
            return Response({"detail": "Diretório indisponível"}, status=503)
        body = request.data
        if not isinstance(body, dict) or set(body) != {"scope_ref", "phones"}:
            return Response({"detail": "Campos inválidos"}, status=422)
        if body["scope_ref"] != scope:
            return Response({"detail": "Escopo não permitido"}, status=403)
        phones = body["phones"]
        if (not isinstance(phones, list) or not 1 <= len(phones) <= 100
                or any(not isinstance(p, str) or not re.fullmatch(r"\+[1-9][0-9]{7,14}", p)
                       for p in phones) or len(set(phones)) != len(phones)):
            return Response({"detail": "Campos inválidos"}, status=422)
        links = WhatsAppIdentity.objects.select_related("user").filter(
            church_id=int(scope), user__church_id=int(scope), user__is_active=True,
            phone__in=phones)
        found = {link.phone: link.user for link in links}
        items = []
        for phone in phones:
            user = found.get(phone)
            items.append({"phone": phone, "status": "verified" if user else "unknown",
                "display_name": (user.get_full_name().strip() or user.username)[:160] if user else None,
                "user_ref": str(user.pk) if user else None})
        response = Response({"scope_ref": scope, "items": items})
        response["Cache-Control"] = "no-store"
        return response
