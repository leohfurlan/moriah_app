"""Testes das checagens de deploy (``manage.py check --deploy``).

Cada guarda aqui existe para barrar um erro classico de piloto: segredo de
exemplo no ar, host curinga, banco remoto sem TLS, comprovante financeiro em
disco efemero ou URL publica permanente.
"""
import pytest
from django.core.management import call_command
from django.test import override_settings

from config.checks import (
    check_arquivos_de_producao,
    check_banco_de_producao,
    check_segredos_de_producao,
)

CHAVE_OK = "k" + "9f3a" * 12

BANCO_REMOTO = {
    "ENGINE": "django.db.backends.postgresql",
    "NAME": "moriah",
    "USER": "moriah",
    "PASSWORD": "senha",
    "HOST": "ep-piloto.neon.tech",
    "PORT": "5432",
    "CONN_MAX_AGE": 60,
    "OPTIONS": {"sslmode": "require"},
}

BANCO_LOCAL = {**BANCO_REMOTO, "HOST": "db", "OPTIONS": {}}

STORAGE_S3 = {
    "default": {
        "BACKEND": "storages.backends.s3.S3Storage",
        "OPTIONS": {"bucket_name": "b", "querystring_auth": True},
    },
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedStaticFilesStorage"},
}


def ids(problems):
    return {problem.id for problem in problems}


def por_id(problems, check_id):
    return [problem for problem in problems if problem.id == check_id]


class TestChecagensDesligadasEmDev:
    """Em dev (DEBUG=true) as guardas nao podem atrapalhar o runserver."""

    @override_settings(DEBUG=True)
    def test_sem_desenvolvimento_nao_ha_problemas(self):
        assert check_segredos_de_producao(None) == []
        assert check_banco_de_producao(None) == []
        assert check_arquivos_de_producao(None) == []


class TestSegredos:
    @override_settings(
        DEBUG=False, SECRET_KEY="change-me", ALLOWED_HOSTS=["piloto.moriah.app"]
    )
    def test_chave_de_exemplo_e_erro(self):
        problems = check_segredos_de_producao(None)
        assert "config.E001" in ids(problems)
        assert por_id(problems, "config.E001")[0].hint

    @override_settings(DEBUG=False, SECRET_KEY=CHAVE_OK, ALLOWED_HOSTS=["*"])
    def test_host_curinga_e_erro(self):
        assert "config.E002" in ids(check_segredos_de_producao(None))

    @override_settings(DEBUG=False, SECRET_KEY=CHAVE_OK, ALLOWED_HOSTS=["piloto.moriah.app"])
    def test_ambiente_de_piloto_bem_configurado_passa(self):
        assert check_segredos_de_producao(None) == []


class TestBanco:
    @override_settings(DEBUG=False, DATABASES={"default": BANCO_REMOTO})
    def test_banco_remoto_com_tls_passa(self):
        assert check_banco_de_producao(None) == []

    @override_settings(
        DEBUG=False,
        DATABASES={"default": {**BANCO_REMOTO, "OPTIONS": {}, "CONN_MAX_AGE": 60}},
    )
    def test_banco_remoto_sem_tls_e_erro(self):
        assert "config.E003" in ids(check_banco_de_producao(None))

    @override_settings(DEBUG=False, DATABASES={"default": BANCO_LOCAL})
    def test_banco_local_nao_exige_tls(self):
        assert check_banco_de_producao(None) == []

    @override_settings(
        DEBUG=False,
        DATABASES={"default": {**BANCO_REMOTO, "CONN_MAX_AGE": 0, "OPTIONS": {"sslmode": "require"}}},
    )
    def test_banco_remoto_sem_reuso_de_conexao_avisa(self):
        assert "config.W004" in ids(check_banco_de_producao(None))

    @override_settings(
        DEBUG=False,
        DATABASES={"default": {**BANCO_REMOTO, "OPTIONS": {"sslmode": "verify-full"}}},
    )
    def test_verify_full_tambem_satisfaz(self):
        assert check_banco_de_producao(None) == []


class TestArquivos:
    @override_settings(
        DEBUG=False,
        USE_S3_STORAGE=True,
        STORAGES=STORAGE_S3,
        CORS_ALLOWED_ORIGINS=["https://app.moriah.app"],
        CSRF_TRUSTED_ORIGINS=["https://app.moriah.app"],
    )
    def test_storage_privado_https_passa(self):
        assert check_arquivos_de_producao(None) == []

    @override_settings(
        DEBUG=False,
        USE_S3_STORAGE=False,
        CORS_ALLOWED_ORIGINS=["https://app.moriah.app"],
        CSRF_TRUSTED_ORIGINS=[],
    )
    def test_disco_local_avisa(self):
        assert "config.W005" in ids(check_arquivos_de_producao(None))

    @override_settings(
        DEBUG=False,
        USE_S3_STORAGE=True,
        STORAGES={
            "default": {
                "BACKEND": "storages.backends.s3.S3Storage",
                "OPTIONS": {"bucket_name": "b"},
            },
            "staticfiles": {"BACKEND": "whitenoise.storage.CompressedStaticFilesStorage"},
        },
        CORS_ALLOWED_ORIGINS=["https://app.moriah.app"],
        CSRF_TRUSTED_ORIGINS=[],
    )
    def test_storage_sem_url_assinada_e_erro(self):
        assert "config.E006" in ids(check_arquivos_de_producao(None))

    @override_settings(
        DEBUG=False,
        USE_S3_STORAGE=True,
        STORAGES=STORAGE_S3,
        CORS_ALLOWED_ORIGINS=["http://localhost:8081"],
        CSRF_TRUSTED_ORIGINS=["http://192.168.24.7:8000"],
    )
    def test_origem_http_avisa(self):
        problems = check_arquivos_de_producao(None)
        assert "config.W007" in ids(problems)
        # A mensagem aponta qual origem ainda esta em http://.
        assert "http://localhost:8081" in por_id(problems, "config.W007")[0].msg


class TestIntegracaoComCheckDeploy:
    """O mesmo comando que o CI roda: precisa passar com ambiente de piloto."""

    @override_settings(
        DEBUG=False,
        SECRET_KEY=CHAVE_OK,
        ALLOWED_HOSTS=["piloto.moriah.app"],
        DATABASES={"default": BANCO_REMOTO},
        USE_S3_STORAGE=True,
        STORAGES=STORAGE_S3,
        CORS_ALLOWED_ORIGINS=["https://app.moriah.app"],
        CSRF_TRUSTED_ORIGINS=["https://app.moriah.app"],
    )
    def test_check_deploy_passa_com_ambiente_de_piloto(self, capsys):
        # Levanta SystemCheckError se qualquer guarda reprovar o ambiente.
        call_command("check", deploy=True)
        saida = capsys.readouterr().out
        assert "W004" not in saida and "W005" not in saida and "W007" not in saida

    @override_settings(
        DEBUG=False,
        SECRET_KEY="change-me",
        ALLOWED_HOSTS=["piloto.moriah.app"],
        DATABASES={"default": BANCO_REMOTO},
        USE_S3_STORAGE=True,
        STORAGES=STORAGE_S3,
        CORS_ALLOWED_ORIGINS=["https://app.moriah.app"],
        CSRF_TRUSTED_ORIGINS=["https://app.moriah.app"],
    )
    def test_check_deploy_reprova_chave_de_exemplo(self):
        from django.core.checks import run_checks

        problemas = run_checks(include_deployment_checks=True)
        assert "config.E001" in {p.id for p in problemas if p.id}
