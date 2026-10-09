"""Leitura de variaveis de ambiente do projeto.

Fica separado de ``settings.py`` para que as regras de configuracao possam ser
testadas sem recarregar o modulo de settings do Django.
"""
from __future__ import annotations

import os

TRUE_VALUES = {"1", "true", "yes", "on"}

# Valores de chave que nunca podem ir para o piloto: sao os que aparecem no
# repositorio (``.env.example``, settings) e portanto sao publicos.
INSECURE_SECRET_KEYS = {
    "",
    "change-me",
    "troque-me",
    "unsafe-dev-secret-key",
}

# Hosts que, fora do modo debug, ainda sao considerados "locais" para efeito da
# checagem de TLS do banco (a conexao nao sai da maquina/rede do compose).
LOCAL_DB_HOSTS = {"", "localhost", "127.0.0.1", "::1", "db", "host.docker.internal"}


def is_insecure_secret_key(value: str | None) -> bool:
    """True quando a chave e vazia ou e um dos valores de exemplo do repositorio."""
    return (value or "").strip().lower() in INSECURE_SECRET_KEYS


def env_flag(name: str, default: str = "false", env: dict | None = None) -> bool:
    """Le um booleano ("1/true/yes/on" ligam) com valor padrao explicito."""
    source = os.environ if env is None else env
    return str(source.get(name, default)).strip().lower() in TRUE_VALUES


def env_int(
    name: str,
    default: str | int,
    env: dict | None = None,
    minimum: int | None = None,
) -> int:
    """Le um inteiro e falha cedo (na subida) se o valor for invalido."""
    source = os.environ if env is None else env
    raw = str(source.get(name, default)).strip()
    try:
        value = int(raw)
    except ValueError as exc:  # pragma: no cover - mensagem coberta por teste
        raise ValueError(f"{name} deve ser um numero inteiro (recebido: {raw!r})") from exc
    if minimum is not None and value < minimum:
        raise ValueError(f"{name} deve ser maior ou igual a {minimum} (recebido: {value})")
    return value


def env_list(name: str, default: str = "", env: dict | None = None) -> list[str]:
    """Le uma lista separada por virgulas, descartando itens vazios."""
    source = os.environ if env is None else env
    return [item.strip() for item in str(source.get(name, default)).split(",") if item.strip()]


def database_config(env: dict | None = None) -> dict:
    """Configuracao do banco principal, com TLS e reuso de conexao explicitos.

    Um Postgres gerenciado (Neon, RDS, Cloud SQL) recusa ou degrada conexoes sem
    TLS: ``POSTGRES_SSLMODE=require`` garante que o trafego nao saia em claro por
    engano. ``POSTGRES_CONN_MAX_AGE`` reaproveita a conexao entre requisicoes e
    ``CONN_HEALTH_CHECKS`` testa a conexao antes de usa-la — o que importa quando
    o compute do Neon hiberna e a conexao do pool morre em silencio.
    """
    source = os.environ if env is None else env
    options: dict[str, str] = {}
    sslmode = str(source.get("POSTGRES_SSLMODE", "")).strip()
    if sslmode:
        options["sslmode"] = sslmode

    config = {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": source.get("POSTGRES_DB", "moriah"),
        "USER": source.get("POSTGRES_USER", "moriah"),
        "PASSWORD": source.get("POSTGRES_PASSWORD", "moriah"),
        "HOST": source.get("POSTGRES_HOST", "db"),
        "PORT": source.get("POSTGRES_PORT", "5432"),
        "CONN_MAX_AGE": env_int("POSTGRES_CONN_MAX_AGE", "0", env, minimum=0),
        "CONN_HEALTH_CHECKS": env_flag("POSTGRES_CONN_HEALTH_CHECKS", "true", env),
    }
    if options:
        config["OPTIONS"] = options
    return config
