from pathlib import Path
import os
import warnings

from dotenv import load_dotenv

from config.env import database_config, env_flag, env_int, env_list, is_insecure_secret_key


BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR.parent / ".env")

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "unsafe-dev-secret-key")
DEBUG = env_flag("DJANGO_DEBUG")
# Sem curinga por padrao: um host aberto em producao facilita ataques de
# Host header. O ambiente de dev define explicitamente no .env.
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")

# Revisao implantada, exposta em /health/ para saber qual commit esta no ar.
APP_REVISION = os.getenv("APP_REVISION", "unknown")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "rest_framework.authtoken",
    "django_filters",
    "drf_spectacular",
    "apps.accounts",
    "apps.members",
    "apps.cells",
    "apps.ministries",
    "apps.events",
    "apps.schedules",
    "apps.finance",
    "apps.content",
    "apps.audit",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    # Serve os estaticos coletados (admin, DRF) direto do processo WSGI, sem
    # nginx na frente. Precisa vir logo apos o SecurityMiddleware.
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "apps.audit.middleware.CurrentUserMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

DATABASES = {"default": database_config()}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "pt-br"
TIME_ZONE = os.getenv("TIME_ZONE", "America/Sao_Paulo")
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = Path(os.getenv("DJANGO_MEDIA_ROOT", str(BASE_DIR / "media")))
PRIVATE_LOCAL_MEDIA = env_flag("PRIVATE_LOCAL_MEDIA")
LOCAL_MEDIA_PERSISTENT = env_flag("LOCAL_MEDIA_PERSISTENT")
LOCAL_MEDIA_URL_EXPIRE_SECONDS = env_int("LOCAL_MEDIA_URL_EXPIRE_SECONDS", 900, minimum=1)

# Os estaticos (admin, DRF, schema) sao servidos pelo proprio processo via
# whitenoise, sem nginx/caddy na frente. O storage comprimido nao usa manifest:
# o nome do arquivo nao carrega hash, entao o cache do navegador fica curto o
# bastante para nao servir CSS antigo depois de um deploy.
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedStaticFilesStorage"},
}
WHITENOISE_MAX_AGE = 0 if DEBUG else 3600

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTH_USER_MODEL = "accounts.User"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.OrderingFilter",
        "rest_framework.filters.SearchFilter",
    ),
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Moriah App API",
    "DESCRIPTION": "API interna da plataforma de gestao da Igreja Moriah.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}

from datetime import timedelta

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=env_int("JWT_ACCESS_MINUTES", "60", minimum=1)),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=env_int("JWT_REFRESH_DAYS", "7", minimum=1)),
    "AUTH_HEADER_TYPES": ("Bearer",),
}

CORS_ALLOWED_ORIGINS = env_list(
    "CORS_ALLOWED_ORIGINS",
    "http://localhost:19006,http://127.0.0.1:19006,exp://127.0.0.1:19000",
)

CSRF_TRUSTED_ORIGINS = env_list(
    "CSRF_TRUSTED_ORIGINS",
    "http://localhost:8000,http://127.0.0.1:8000",
)

FILE_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024


# --- Armazenamento de comprovantes ------------------------------------------
# Em dev os anexos ficam em ``backend/media/``. Em homologacao/producao eles
# precisam ir para storage externo (S3 ou Cloudflare R2): o disco do container
# e efemero e um redeploy levaria embora os comprovantes ja validados.
#
# Os arquivos sao **privados**: `querystring_auth` faz o Django devolver URLs
# assinadas e temporarias, para que um comprovante nunca fique acessivel por
# link publico permanente (dado financeiro individual, secao 13 do PRD).
USE_S3_STORAGE = env_flag("USE_S3_STORAGE")

if USE_S3_STORAGE:
    STORAGES["default"] = {
        "BACKEND": "storages.backends.s3.S3Storage",
        "OPTIONS": {
            "bucket_name": os.getenv("S3_BUCKET_NAME"),
            "access_key": os.getenv("S3_ACCESS_KEY_ID"),
            "secret_key": os.getenv("S3_SECRET_ACCESS_KEY"),
            "endpoint_url": os.getenv("S3_ENDPOINT_URL") or None,
            "region_name": os.getenv("S3_REGION_NAME", "auto"),
            "default_acl": None,
            "querystring_auth": True,
            "querystring_expire": int(os.getenv("S3_URL_EXPIRE_SECONDS", "900")),
            "file_overwrite": False,
            "signature_version": "s3v4",
        },
    }

# Atras de um proxy/tunel HTTPS (ngrok, nginx, load balancer), o Django recebe
# a requisicao em HTTP e monta URLs absolutas com "http://" — inclusive os links
# de comprovante. Este flag manda confiar no X-Forwarded-Proto tambem em modo
# debug. Ligue apenas quando houver de fato um proxy na frente: sem ele,
# qualquer cliente poderia se declarar seguro.
if env_flag("DJANGO_TRUST_PROXY_SSL_HEADER"):
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# Os endpoints de saude ficam isentos do redirect para HTTPS: o healthcheck do
# Docker fala HTTP de dentro do container e, sem a excecao, receberia 301 e
# nunca ficaria saudavel. Definido fora do bloco de DEBUG para poder ser testado.
SECURE_REDIRECT_EXEMPT = [r"^health/$", r"^health/ready/$"]

# --- Endurecimento de producao ----------------------------------------------
# Fora do modo debug assume-se HTTPS (requisito da secao 13 do PRD).
if not DEBUG:
    SECURE_SSL_REDIRECT = env_flag("DJANGO_SECURE_SSL_REDIRECT", "true")
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = int(os.getenv("DJANGO_HSTS_SECONDS", "31536000"))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = "DENY"

    if is_insecure_secret_key(SECRET_KEY):
        warnings.warn(
            "DJANGO_SECRET_KEY nao foi definido: a chave de exemplo do repositorio "
            "esta em uso fora do modo debug. Defina uma chave propria antes do deploy.",
            RuntimeWarning,
        )

# --- Logs para container ------------------------------------------------------
# O Docker captura stdout/stderr: log em console com timestamp, sem escrever em
# arquivo dentro do container (que seria perdido no redeploy).
LOG_LEVEL = os.getenv("DJANGO_LOG_LEVEL", "INFO")
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "console": {"format": "%(asctime)s %(levelname)s %(name)s %(message)s"},
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "console"},
    },
    "root": {"handlers": ["console"], "level": LOG_LEVEL},
    "loggers": {
        "django.request": {"handlers": ["console"], "level": "INFO", "propagate": False},
        "django.security": {"handlers": ["console"], "level": "INFO", "propagate": False},
        # Consultas SQL so entram no log em nivel WARNING (evita log de dados).
        "django.db.backends": {
            "handlers": ["console"],
            "level": os.getenv("DJANGO_DB_LOG_LEVEL", "WARNING"),
            "propagate": False,
        },
    },
}

# Registra as checagens de deploy (config/checks.py) em `manage.py check --deploy`.
from config import checks  # noqa: E402,F401  (import no fim: depende das settings acima)
