"""Disposable static collection only; never used by WSGI or migrations."""
import os
os.environ["DJANGO_SECRET_KEY"] = "build-only-disposable-e08f2a" * 3
from .settings import *  # noqa: F401,F403,E402
DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}}
MFA_REQUIRED = False
