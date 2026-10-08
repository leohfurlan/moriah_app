"""Checagens de configuracao do ambiente de piloto/producao.

Registradas com ``deploy=True``: rodam apenas em ``manage.py check --deploy``,
que o CI executa a cada push e que o runbook de deploy roda antes de liberar a
versao. Nada aqui interfere no desenvolvimento local (que usa ``DEBUG=true``).
"""
from django.conf import settings
from pathlib import Path
from django.core.checks import Error, Tags, Warning, register

from .env import LOCAL_DB_HOSTS, is_insecure_secret_key

SECRET_KEY_HINT = (
    'Gere uma chave propria e guarde no .env do servidor: '
    'python -c "import secrets; print(secrets.token_urlsafe(64))"'
)


@register(Tags.security, deploy=True)
def check_segredos_de_producao(app_configs, **kwargs):
    """Barrar valores de exemplo: eles estao no repositorio, logo sao publicos."""
    if settings.DEBUG:
        return []

    problems = []
    if is_insecure_secret_key(settings.SECRET_KEY):
        problems.append(
            Error(
                "DJANGO_SECRET_KEY esta com valor de exemplo/desenvolvimento.",
                hint=SECRET_KEY_HINT,
                id="config.E001",
            )
        )
    if "*" in settings.ALLOWED_HOSTS:
        problems.append(
            Error(
                "DJANGO_ALLOWED_HOSTS aceita qualquer host ('*') fora do modo debug.",
                hint="Liste apenas os dominios reais do piloto (ex: homologacao.moriah.app).",
                id="config.E002",
            )
        )
    return problems


@register(Tags.security, deploy=True)
def check_banco_de_producao(app_configs, **kwargs):
    """Banco gerenciado exige TLS e ganha com reuso de conexao."""
    if settings.DEBUG:
        return []

    database = settings.DATABASES.get("default", {})
    options = database.get("OPTIONS") or {}
    sslmode = str(options.get("sslmode", "")).strip().lower()
    host = str(database.get("HOST", "")).strip().lower()

    problems = []
    if host not in LOCAL_DB_HOSTS and not sslmode.startswith(("require", "verify")):
        problems.append(
            Error(
                f"Banco remoto ('{host}') sem TLS: defina POSTGRES_SSLMODE=require.",
                hint="O Neon recusa conexoes sem TLS; deixe explicito no .env do servidor.",
                id="config.E003",
            )
        )
    if host not in LOCAL_DB_HOSTS and not database.get("CONN_MAX_AGE"):
        problems.append(
            Warning(
                "Banco remoto sem reuso de conexao (POSTGRES_CONN_MAX_AGE=0).",
                hint="Use POSTGRES_CONN_MAX_AGE=60: evita abrir conexao nova por requisicao.",
                id="config.W004",
            )
        )
    return problems


@register(Tags.security, deploy=True)
def check_arquivos_de_producao(app_configs, **kwargs):
    """Comprovantes financeiros nao podem viver no disco efemero do container."""
    if settings.DEBUG:
        return []

    problems = []
    persistent_local = (
        getattr(settings, "PRIVATE_LOCAL_MEDIA", False)
        and getattr(settings, "LOCAL_MEDIA_PERSISTENT", False)
        and Path(settings.MEDIA_ROOT).is_mount()
    )
    if not getattr(settings, "USE_S3_STORAGE", False) and not persistent_local:
        problems.append(
            Warning(
                "USE_S3_STORAGE=false fora do modo debug: comprovantes ficam no disco "
                "do container e somem no proximo deploy.",
                hint="Ligue USE_S3_STORAGE e configure S3_* (S3 ou Cloudflare R2).",
                id="config.W005",
            )
        )
    elif getattr(settings, "USE_S3_STORAGE", False):
        storage = (settings.STORAGES or {}).get("default", {})
        options = storage.get("OPTIONS") or {}
        if not options.get("querystring_auth"):
            problems.append(
                Error(
                    "Storage de comprovantes sem URL assinada (querystring_auth).",
                    hint="Comprovante financeiro nao pode ter URL publica permanente.",
                    id="config.E006",
                )
            )

    insecure_origins = [
        origin
        for origin in list(settings.CORS_ALLOWED_ORIGINS) + list(settings.CSRF_TRUSTED_ORIGINS)
        if origin.startswith("http://")
    ]
    if insecure_origins:
        problems.append(
            Warning(
                "Origens http:// liberadas fora do modo debug: " + ", ".join(sorted(set(insecure_origins))),
                hint="No piloto aponte CORS_ALLOWED_ORIGINS/CSRF_TRUSTED_ORIGINS para https://.",
                id="config.W007",
            )
        )
    return problems
