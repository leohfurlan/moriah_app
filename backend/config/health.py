"""Endpoints de saude usados pelo healthcheck do compose e pelo monitoramento.

Sao publicos (nao exigem token) e nao devolvem nada sobre a configuracao
interna: apenas o status, a revisao implantada e, na prontidao, se o banco
respondeu. Detalhe de erro de conexao fica no log do container.
"""
import logging

from django.conf import settings
from django.db import connections
from django.http import JsonResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_GET

logger = logging.getLogger(__name__)


def _payload(status: str, **extra) -> dict:
    return {"status": status, "revision": settings.APP_REVISION, **extra}


@never_cache
@require_GET
def liveness(request):
    """Liveness: o processo de aplicacao responde. Nao toca no banco.

    E o alvo do healthcheck do Docker: banco fora do ar nao deve fazer o
    container reiniciar em loop, apenas sair da rota de trafego (prontidao).
    """
    return JsonResponse(_payload("ok"))


@never_cache
@require_GET
def readiness(request):
    """Prontidao: processo + banco acessivel. Devolve 503 se o banco falhar."""
    try:
        with connections["default"].cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    except Exception:  # noqa: BLE001 - qualquer falha do banco vira 503
        logger.warning("healthcheck de prontidao: banco nao respondeu", exc_info=True)
        return JsonResponse(_payload("degraded", database="unavailable"), status=503)
    return JsonResponse(_payload("ready", database="ok"))
