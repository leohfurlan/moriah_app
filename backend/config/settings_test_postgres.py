"""Testes isolados em PostgreSQL; Django usa o banco test_<POSTGRES_DB>."""
from .settings_test import *  # noqa: F401,F403
from .settings import DATABASES as POSTGRES_DATABASES

DATABASES = POSTGRES_DATABASES
