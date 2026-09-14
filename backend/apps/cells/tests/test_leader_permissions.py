"""Regras da secao 6 do PRD para o lider de celula.

O lider enxerga apenas a propria celula, e quem nao e lider nao alcanca
esses endpoints. Sem estes testes, um erro de filtro exporia a lista de
membros de outras celulas.
"""
import datetime

import pytest

from apps.accounts.models import User
from apps.cells.models import Cell, CellMeeting

pytestmark = pytest.mark.django_db

CELL_MEMBERS_URL = "/api/leader/cell-members/"
CELL_MEETINGS_URL = "/api/cell-meetings/"


@pytest.fixture
def duas_celulas(make_user, make_member, church):
    """Duas celulas com lideres e membros distintos."""
    lider_a = make_user("lider.a@igreja.com", role=User.Role.CELL_LEADER)
    lider_b = make_user("lider.b@igreja.com", role=User.Role.CELL_LEADER)
    celula_a = Cell.objects.create(church=church, name="Celula Norte", leader=lider_a)
    celula_b = Cell.objects.create(church=church, name="Celula Sul", leader=lider_b)
    membro_a = make_member("Membro da Norte", cell=celula_a)
    membro_b = make_member("Membro da Sul", cell=celula_b)
    return {
        "lider_a": lider_a,
        "lider_b": lider_b,
        "celula_a": celula_a,
        "celula_b": celula_b,
        "membro_a": membro_a,
        "membro_b": membro_b,
    }


def test_lider_lista_apenas_membros_da_propria_celula(api_client, duas_celulas):
    api_client.force_authenticate(user=duas_celulas["lider_a"])

    response = api_client.get(CELL_MEMBERS_URL)

    assert response.status_code == 200
    nomes = {item["full_name"] for item in response.data}
    assert nomes == {"Membro da Norte"}


def test_membro_comum_nao_acessa_lista_de_celula(api_client, make_user, duas_celulas):
    membro = make_user("membro.curioso@igreja.com", role=User.Role.MEMBER)
    api_client.force_authenticate(user=membro)

    response = api_client.get(CELL_MEMBERS_URL)

    assert response.status_code == 403


def test_membro_comum_nao_registra_reuniao_de_celula(api_client, make_user, duas_celulas):
    membro = make_user("membro.reuniao@igreja.com", role=User.Role.MEMBER)
    api_client.force_authenticate(user=membro)

    response = api_client.post(
        CELL_MEETINGS_URL,
        {"date": "2026-08-20", "visitors_count": 0, "attendances": []},
        format="json",
    )

    assert response.status_code == 403
    assert not CellMeeting.objects.exists()


def test_reuniao_e_gravada_na_celula_do_lider_com_presenca(api_client, duas_celulas):
    api_client.force_authenticate(user=duas_celulas["lider_a"])

    response = api_client.post(
        CELL_MEETINGS_URL,
        {
            "date": "2026-08-20",
            "visitors_count": 2,
            "notes": "Reuniao normal",
            "attendances": [{"member_id": duas_celulas["membro_a"].id, "present": True}],
        },
        format="json",
    )

    assert response.status_code == 201
    reuniao = CellMeeting.objects.get()
    # A celula vem do lider autenticado, nunca do payload.
    assert reuniao.cell == duas_celulas["celula_a"]
    assert reuniao.date == datetime.date(2026, 8, 20)
    assert [a.member for a in reuniao.attendances.all()] == [duas_celulas["membro_a"]]


def test_presenca_de_membro_de_outra_celula_e_ignorada(api_client, duas_celulas):
    api_client.force_authenticate(user=duas_celulas["lider_a"])

    response = api_client.post(
        CELL_MEETINGS_URL,
        {
            "date": "2026-08-20",
            "visitors_count": 0,
            "attendances": [{"member_id": duas_celulas["membro_b"].id, "present": True}],
        },
        format="json",
    )

    assert response.status_code == 201
    # O membro da celula Sul nao pode entrar na ata da celula Norte.
    assert not CellMeeting.objects.get().attendances.exists()
