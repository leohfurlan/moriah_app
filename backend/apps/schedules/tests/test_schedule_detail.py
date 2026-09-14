"""Detalhe da escala: equipe escalada e repertorio do culto."""
import datetime

import pytest

from apps.accounts.models import User
from apps.events.models import Event
from apps.ministries.models import Ministry, MinistryRole
from apps.schedules.models import Schedule, ScheduleAssignment, ScheduleItem

pytestmark = pytest.mark.django_db


@pytest.fixture
def culto(make_user, make_member, church):
    """Um culto com 3 escalados no louvor e um repertorio de 3 itens."""
    evento = Event.objects.create(
        church=church,
        name="Culto de Domingo",
        location="Templo Sede",
        start_at=datetime.datetime(2026, 8, 30, 19, 0, tzinfo=datetime.timezone.utc),
    )
    escala = Schedule.objects.create(
        church=church, event=evento, name="Louvor", notes="Chegar 18h para passagem de som."
    )
    ministerio = Ministry.objects.create(church=church, name="Louvor")

    equipe = {}
    for nome, funcao, status in [
        ("Maria Silva", "Vocal", ScheduleAssignment.Status.CONFIRMED),
        ("Joao Pedro", "Guitarra", ScheduleAssignment.Status.PENDING),
        ("Ana Costa", "Teclado", ScheduleAssignment.Status.DECLINED),
    ]:
        user = make_user(f"{funcao.lower()}@igreja.com")
        membro = make_member(nome, user=user)
        role = MinistryRole.objects.create(church=church, ministry=ministerio, name=funcao)
        equipe[funcao] = ScheduleAssignment.objects.create(
            church=church, schedule=escala, member=membro, ministry_role=role, status=status
        )

    # Criados fora de ordem de proposito: a API deve devolver ordenado.
    ScheduleItem.objects.create(
        church=church, schedule=escala, order=3, item_type=ScheduleItem.ItemType.MOMENT,
        title="Ministracao da Palavra",
    )
    ScheduleItem.objects.create(
        church=church, schedule=escala, order=1, title="Grande e o Senhor",
        song_key="G", reference_url="https://exemplo.com/cifra",
    )
    ScheduleItem.objects.create(
        church=church, schedule=escala, order=2, title="Teu Amor Nao Falha", song_key="D",
    )
    return {"escala": escala, "equipe": equipe}


def test_detalhe_traz_repertorio_na_ordem_correta(api_client, culto):
    minha = culto["equipe"]["Vocal"]
    api_client.force_authenticate(user=minha.member.user)

    response = api_client.get(f"/api/me/schedules/{minha.id}/")

    assert response.status_code == 200
    repertorio = response.data["repertoire"]
    assert [item["title"] for item in repertorio] == [
        "Grande e o Senhor",
        "Teu Amor Nao Falha",
        "Ministracao da Palavra",
    ]
    assert repertorio[0]["song_key"] == "G"
    assert repertorio[0]["reference_url"] == "https://exemplo.com/cifra"
    assert repertorio[2]["item_type_display"] == "Momento"


def test_detalhe_traz_equipe_completa_com_status(api_client, culto):
    minha = culto["equipe"]["Vocal"]
    api_client.force_authenticate(user=minha.member.user)

    response = api_client.get(f"/api/me/schedules/{minha.id}/")

    equipe = {item["member_name"]: item for item in response.data["team"]}
    assert set(equipe) == {"Maria Silva", "Joao Pedro", "Ana Costa"}
    assert equipe["Maria Silva"]["status"] == "confirmed"
    assert equipe["Joao Pedro"]["status"] == "pending"
    assert equipe["Ana Costa"]["status_display"] == "Recusado"
    # O proprio usuario vem marcado, para a tela destacar quem e quem.
    assert equipe["Maria Silva"]["is_me"] is True
    assert equipe["Joao Pedro"]["is_me"] is False


def test_detalhe_nao_expoe_dados_pessoais_da_equipe(api_client, culto):
    minha = culto["equipe"]["Vocal"]
    api_client.force_authenticate(user=minha.member.user)

    response = api_client.get(f"/api/me/schedules/{minha.id}/")

    for integrante in response.data["team"]:
        assert "phone" not in integrante
        assert "email" not in integrante


def test_detalhe_traz_dados_do_culto_e_observacoes(api_client, culto):
    minha = culto["equipe"]["Vocal"]
    api_client.force_authenticate(user=minha.member.user)

    response = api_client.get(f"/api/me/schedules/{minha.id}/")

    assert response.data["event_name"] == "Culto de Domingo"
    assert response.data["event_location"] == "Templo Sede"
    assert response.data["schedule_notes"] == "Chegar 18h para passagem de som."
    assert response.data["role_name"] == "Vocal"


def test_membro_nao_abre_detalhe_de_escala_alheia(api_client, culto, make_user, make_member):
    forasteiro = make_user("forasteiro@igreja.com")
    make_member("Nao Escalado", user=forasteiro)
    api_client.force_authenticate(user=forasteiro)

    response = api_client.get(f"/api/me/schedules/{culto['equipe']['Vocal'].id}/")

    assert response.status_code == 404


def test_usuario_sem_cadastro_de_membro_nao_abre_detalhe(api_client, culto, make_user):
    admin = make_user("admin.detalhe@igreja.com", role=User.Role.ADMIN)
    api_client.force_authenticate(user=admin)

    response = api_client.get(f"/api/me/schedules/{culto['equipe']['Vocal'].id}/")

    assert response.status_code == 403


def test_escala_sem_repertorio_devolve_lista_vazia(api_client, culto):
    culto["escala"].items.all().delete()
    minha = culto["equipe"]["Vocal"]
    api_client.force_authenticate(user=minha.member.user)

    response = api_client.get(f"/api/me/schedules/{minha.id}/")

    assert response.status_code == 200
    assert response.data["repertoire"] == []
