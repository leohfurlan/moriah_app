"""Configuracoes de teste.

Herda de ``config.settings`` e sobrescreve apenas o necessario para rodar a
suite de testes de forma isolada e rapida, sem depender de um Postgres externo.
"""
import tempfile

from .settings import *  # noqa: F401,F403

# Testes rodam sem o modo debug (respostas de erro limpas, ex: 404 real).
DEBUG = False
ALLOWED_HOSTS = ["*"]

# Banco em memoria para os testes (nao depende do Postgres do docker-compose).
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

# Hash de senha rapido acelera a criacao de usuarios nos testes.
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

# Uploads dos testes vao para um diretorio temporario descartavel, sempre em
# disco local — os testes nunca devem falar com S3/R2.
MEDIA_ROOT = tempfile.mkdtemp(prefix="moriah-test-media-")
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}

# O endurecimento de producao (settings.py) liga com DEBUG=False; o test client
# fala HTTP, entao o redirect para HTTPS precisa ficar desligado aqui.
SECURE_SSL_REDIRECT = False
SECURE_HSTS_SECONDS = 0
