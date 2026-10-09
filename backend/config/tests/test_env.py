"""Testes dos helpers de leitura de ambiente (``config/env.py``)."""
import pytest

from config.env import (
    database_config,
    env_flag,
    env_int,
    env_list,
    is_insecure_secret_key,
)


class TestEnvFlag:
    @pytest.mark.parametrize("raw", ["1", "true", "TRUE", "Yes", "on", " on "])
    def test_valores_que_ligam(self, raw):
        assert env_flag("X", env={"X": raw}) is True

    @pytest.mark.parametrize("raw", ["0", "false", "no", "off", "", "qualquer"])
    def test_valores_que_desligam(self, raw):
        assert env_flag("X", env={"X": raw}) is False

    def test_padrao_quando_ausente(self):
        assert env_flag("AUSENTE", "true", env={}) is True
        assert env_flag("AUSENTE", "false", env={}) is False


class TestEnvInt:
    def test_le_inteiro(self):
        assert env_int("X", "10", env={"X": "42"}, minimum=1) == 42

    def test_padrao_quando_ausente(self):
        assert env_int("AUSENTE", 60, env={}) == 60

    def test_valor_invalido_falha_na_subida(self):
        with pytest.raises(ValueError, match="inteiro"):
            env_int("X", "10", env={"X": "60s"})

    def test_minimo_respeitado(self):
        with pytest.raises(ValueError, match="maior ou igual"):
            env_int("X", "10", env={"X": "-1"}, minimum=0)


class TestEnvList:
    def test_separa_e_limpa(self):
        assert env_list("X", env={"X": "a, b ,,c"}) == ["a", "b", "c"]

    def test_lista_vazia(self):
        assert env_list("X", "", env={}) == []


class TestIsInsecureSecretKey:
    @pytest.mark.parametrize(
        "value",
        ["", "   ", "change-me", "troque-me", "unsafe-dev-secret-key", "CHANGE-ME"],
    )
    def test_barra_valores_do_repositorio(self, value):
        assert is_insecure_secret_key(value) is True

    def test_aceita_chave_propria(self):
        assert is_insecure_secret_key("k" + "9f3a" * 12) is False

    def test_aceita_none(self):
        assert is_insecure_secret_key(None) is True


class TestDatabaseConfig:
    def test_padroes_de_dev(self):
        config = database_config(env={})
        assert config["ENGINE"] == "django.db.backends.postgresql"
        assert config["HOST"] == "db"
        assert config["CONN_MAX_AGE"] == 0
        assert config["CONN_HEALTH_CHECKS"] is True
        # Sem POSTGRES_SSLMODE nao se inventa TLS: o check --deploy e quem cobra.
        assert "OPTIONS" not in config

    def test_tls_e_reuso_de_conexao(self):
        config = database_config(
            env={
                "POSTGRES_HOST": "ep-cold-pool.neon.tech",
                "POSTGRES_SSLMODE": "require",
                "POSTGRES_CONN_MAX_AGE": "60",
            }
        )
        assert config["OPTIONS"] == {"sslmode": "require"}
        assert config["CONN_MAX_AGE"] == 60
        assert config["HOST"] == "ep-cold-pool.neon.tech"

    def test_sslmode_vazio_nao_vira_option(self):
        assert "OPTIONS" not in database_config(env={"POSTGRES_SSLMODE": ""})

    def test_conn_max_age_invalido_falha(self):
        with pytest.raises(ValueError):
            database_config(env={"POSTGRES_CONN_MAX_AGE": "muito"})
