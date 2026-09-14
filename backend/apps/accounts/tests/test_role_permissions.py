"""Permissoes de cada papel no Django Admin (secao 6 do PRD).

A operacao do MVP acontece no Django Admin. Estes testes garantem que o
mapeamento papel -> grupo continua fiel ao PRD, principalmente as duas
regras mais sensiveis: tesouraria valida contribuicao, e secretaria **nao**
enxerga valores individuais de contribuicao.
"""
import pytest

from apps.accounts.models import User
from apps.accounts.roles import ROLE_GROUPS, apply_role, sync_role_permissions

pytestmark = pytest.mark.django_db


@pytest.fixture
def papeis(make_user):
    """Um usuario de cada papel, com permissoes ja sincronizadas."""
    users = {
        role: make_user(f"{role}@igreja.com", role=role)
        for role in (
            User.Role.TREASURER,
            User.Role.SECRETARY,
            User.Role.COORDINATOR,
            User.Role.PASTOR,
            User.Role.CELL_LEADER,
            User.Role.MEMBER,
        )
    }
    sync_role_permissions()
    for user in users.values():
        user.refresh_from_db()
    return users


def _perms(user: User) -> set[str]:
    # Recarrega do banco: o cache de permissoes fica preso a instancia.
    return User.objects.get(pk=user.pk).get_all_permissions()


def test_tesoureiro_valida_contribuicao_no_admin(papeis):
    tesoureiro = papeis[User.Role.TREASURER]

    assert tesoureiro.is_staff
    permissoes = _perms(tesoureiro)
    assert "finance.change_contribution" in permissoes
    assert "finance.view_contribution" in permissoes


def test_tesoureiro_nao_edita_cadastro_de_membro(papeis):
    permissoes = _perms(papeis[User.Role.TREASURER])

    assert "members.view_member" in permissoes
    assert "members.change_member" not in permissoes


def test_secretaria_cadastra_membro_mas_nao_ve_contribuicao(papeis):
    secretaria = papeis[User.Role.SECRETARY]

    assert secretaria.is_staff
    permissoes = _perms(secretaria)
    assert "members.add_member" in permissoes
    assert "cells.add_cell" in permissoes
    # Valor individual de contribuicao e dado restrito (secao 13 do PRD).
    assert not any(p.startswith("finance.") for p in permissoes)


def test_membro_comum_nao_entra_no_admin(papeis):
    membro = papeis[User.Role.MEMBER]

    assert not membro.is_staff
    assert not membro.groups.exists()
    assert not _perms(membro)


def test_lider_de_celula_opera_pelo_app_e_nao_pelo_admin(papeis):
    lider = papeis[User.Role.CELL_LEADER]

    assert not lider.is_staff
    assert not lider.groups.exists()


def test_coordenador_gerencia_escalas_sem_financeiro(papeis):
    coordenador = papeis[User.Role.COORDINATOR]

    assert coordenador.is_staff
    permissoes = _perms(coordenador)
    assert "schedules.add_schedule" in permissoes
    assert "schedules.change_scheduleassignment" in permissoes
    assert not any(p.startswith("finance.") for p in permissoes)


def test_pastor_consulta_auditoria(papeis):
    permissoes = _perms(papeis[User.Role.PASTOR])

    assert "audit.view_auditlog" in permissoes
    # Leitura da trilha, nunca edicao: auditoria adulteravel nao e auditoria.
    assert "audit.change_auditlog" not in permissoes
    assert "audit.delete_auditlog" not in permissoes


def test_mudanca_de_papel_revoga_acesso_anterior(papeis):
    usuario = papeis[User.Role.TREASURER]
    assert usuario.is_staff

    usuario.role = User.Role.MEMBER
    usuario.save(update_fields=["role"])
    apply_role(usuario)
    usuario.refresh_from_db()

    assert not usuario.is_staff
    assert not usuario.groups.exists()
    assert not _perms(usuario)


def test_sincronizacao_e_idempotente(papeis):
    antes = _perms(papeis[User.Role.SECRETARY])

    sync_role_permissions()
    sync_role_permissions()

    assert _perms(papeis[User.Role.SECRETARY]) == antes
    assert len(ROLE_GROUPS) == 4


def test_superusuario_nao_e_afetado_pela_sincronizacao(make_user):
    root = make_user("root@igreja.com", role=User.Role.MEMBER, is_superuser=True, is_staff=True)

    sync_role_permissions()
    root.refresh_from_db()

    # Rebaixar o superusuario por causa do campo `role` trancaria o admin.
    assert root.is_staff
    assert root.is_superuser
