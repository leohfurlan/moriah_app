"""Fixtures compartilhadas da suite de testes do backend."""
import pytest
from rest_framework.test import APIClient

from apps.accounts.models import Church, User
from apps.members.models import Member

DEFAULT_PASSWORD = "senha-forte-123"


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def church(db):
    return Church.objects.create(name="Igreja Central")


@pytest.fixture
def make_user(db, church):
    """Cria um usuario vinculado a igreja padrao."""

    def _make_user(email, password=DEFAULT_PASSWORD, role=User.Role.MEMBER, **extra):
        return User.objects.create_user(
            username=email,
            email=email,
            password=password,
            church=church,
            role=role,
            **extra,
        )

    return _make_user


@pytest.fixture
def make_member(db, church):
    """Cria um membro, opcionalmente vinculado a um usuario."""

    def _make_member(full_name, user=None, **extra):
        return Member.objects.create(
            church=church,
            user=user,
            full_name=full_name,
            **extra,
        )

    return _make_member
