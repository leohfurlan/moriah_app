import pytest

from apps.events.models import Event
from apps.ministries.models import Ministry, MinistryRole
from apps.schedules.models import Schedule, ScheduleAssignment

pytestmark = pytest.mark.django_db


def test_admin_cria_evento_e_escala_no_mvp(api_client, make_user):
    admin = make_user("admin@igreja.com", role="admin")
    api_client.force_authenticate(user=admin)

    response = api_client.post(
        "/api/schedules/",
        {
            "event_name": "Culto especial",
            "event_type": "especial",
            "start_at": "2026-09-20T19:00:00-03:00",
            "location": "Auditório",
            "schedule_name": "Escala culto especial",
            "status": "draft",
        },
        format="json",
    )

    assert response.status_code == 201
    assert Event.objects.filter(name="Culto especial", church=admin.church).exists()
    assert Schedule.objects.filter(name="Escala culto especial", church=admin.church, status=Schedule.Status.DRAFT).exists()


def test_criacao_publicada_exige_integrante_e_nao_deixa_escala_vazia(api_client, make_user):
    admin = make_user("admin.publica.vazia@igreja.com", role="admin")
    api_client.force_authenticate(user=admin)

    response = api_client.post(
        "/api/schedules/",
        {
            "event_name": "Culto sem equipe",
            "event_type": "culto",
            "start_at": "2026-09-20T19:00:00-03:00",
            "schedule_name": "Escala vazia publicada",
            "status": "published",
        },
        format="json",
    )

    assert response.status_code == 400, response.data
    assert "ao menos um integrante" in str(response.data)
    assert not Schedule.objects.filter(name="Escala vazia publicada").exists()
    assert not Event.objects.filter(name="Culto sem equipe").exists()


def test_criacao_publicada_com_integrante_continua_valida(api_client, make_user, make_member):
    admin = make_user("admin.publica.completa@igreja.com", role="admin")
    ministerio = Ministry.objects.create(church=admin.church, name="Louvor")
    funcao = MinistryRole.objects.create(church=admin.church, ministry=ministerio, name="Vocal")
    membro = make_member("Integrante Publicado")
    api_client.force_authenticate(user=admin)

    response = api_client.post(
        "/api/schedules/",
        {
            "event_name": "Culto com equipe",
            "event_type": "culto",
            "start_at": "2026-09-20T19:00:00-03:00",
            "schedule_name": "Escala completa publicada",
            "ministry_id": ministerio.id,
            "status": "published",
            "assignments": [{"member_id": membro.id, "ministry_role_id": funcao.id}],
        },
        format="json",
    )

    assert response.status_code == 201, response.data
    escala = Schedule.objects.get(name="Escala completa publicada")
    assert escala.status == Schedule.Status.PUBLISHED
    assert ScheduleAssignment.objects.filter(schedule=escala, member=membro, ministry_role=funcao).exists()
def test_membro_nao_cria_escala_e_recebe_mensagem_em_portugues(api_client, make_user):
    """Fase 1 do plano: o 403 de escala precisa explicar o que falta, em PT-BR."""
    membro = make_user("membro.sem.escala@igreja.com", role="member")
    api_client.force_authenticate(user=membro)

    response = api_client.post(
        "/api/schedules/",
        {
            "event_name": "Escala proibida",
            "event_type": "culto",
            "start_at": "2026-09-27T19:00:00-03:00",
            "location": "Templo",
            "schedule_name": "Escala proibida",
            "status": "published",
        },
        format="json",
    )

    assert response.status_code == 403
    detalhe = str(response.data.get("detail", ""))
    assert "coordenadores de escala" in detalhe
    assert "secretaria" in detalhe
    assert not Schedule.objects.filter(name="Escala proibida").exists()
    assert not Event.objects.filter(name="Escala proibida").exists()


@pytest.mark.parametrize("papel", ["admin", "pastor"])
def test_lideranca_cria_escala_sem_ministerio(api_client, make_user, papel):
    """A capacidade publicada em /api/me/ tem que casar com esta permissao."""
    gestor = make_user(f"gestor.escala.{papel}@igreja.com", role=papel)
    api_client.force_authenticate(user=gestor)

    response = api_client.post(
        "/api/schedules/",
        {
            "event_name": f"Culto {papel}",
            "event_type": "culto",
            "start_at": "2026-09-27T19:00:00-03:00",
            "location": "Templo",
            "schedule_name": f"Escala {papel}",
            "status": "draft",
        },
        format="json",
    )

    assert response.status_code == 201, response.data
    assert "manage_schedules" in api_client.get("/api/me/").data["capabilities"]


def test_coordenador_cria_escala_do_ministerio_que_coordena(api_client, make_user):
    """C1: coordenador monta escala, mas so declarando o ministerio dele."""
    coordenador = make_user("coordenador.louvor@igreja.com", role="coordinator")
    ministerio = Ministry.objects.create(church=coordenador.church, name="Louvor")
    ministerio.coordinators.add(coordenador)
    api_client.force_authenticate(user=coordenador)

    response = api_client.post(
        "/api/schedules/",
        {
            "event_name": "Culto do Louvor",
            "event_type": "culto",
            "start_at": "2026-09-27T19:00:00-03:00",
            "location": "Templo",
            "schedule_name": "Escala do Louvor",
            "ministry_id": ministerio.id,
        },
        format="json",
    )

    assert response.status_code == 201, response.data
    assert response.data["ministry"] == ministerio.id
    assert response.data["status"] == Schedule.Status.DRAFT
    assert Schedule.objects.get(pk=response.data["id"]).ministry_id == ministerio.id
    assert "manage_schedules" in api_client.get("/api/me/").data["capabilities"]


def test_criacao_sem_status_nasce_como_rascunho(api_client, make_user):
    """Decisao 4.2: a escala so aparece para o membro depois de publicada."""
    admin = make_user("admin.rascunho@igreja.com", role="admin")
    api_client.force_authenticate(user=admin)

    response = api_client.post(
        "/api/schedules/",
        {
            "event_name": "Culto em rascunho",
            "event_type": "culto",
            "start_at": "2026-09-27T19:00:00-03:00",
            "location": "Templo",
            "schedule_name": "Escala em rascunho",
        },
        format="json",
    )

    assert response.status_code == 201, response.data
    assert response.data["status"] == Schedule.Status.DRAFT
    assert response.data["published_at"] is None
    assert Schedule.objects.get(pk=response.data["id"]).status == Schedule.Status.DRAFT


def test_coordenador_nao_cria_escala_de_ministerio_que_nao_coordena(api_client, make_user):
    """C1: sem escopo de ministerio, a criacao e recusada em PT-BR."""
    coordenador = make_user("coordenador.recepcao@igreja.com", role="coordinator")
    meu = Ministry.objects.create(church=coordenador.church, name="Recepcao")
    meu.coordinators.add(coordenador)
    outro = Ministry.objects.create(church=coordenador.church, name="Louvor")
    api_client.force_authenticate(user=coordenador)

    response = api_client.post(
        "/api/schedules/",
        {
            "event_name": "Culto de outro ministerio",
            "event_type": "culto",
            "start_at": "2026-09-27T19:00:00-03:00",
            "location": "Templo",
            "schedule_name": "Escala de outro ministerio",
            "ministry_id": outro.id,
        },
        format="json",
    )

    assert response.status_code == 400, response.data
    assert "coordena outro ministerio" in str(response.data["ministry_id"])
    assert not Schedule.objects.filter(name="Escala de outro ministerio").exists()

    sem_ministerio = api_client.post(
        "/api/schedules/",
        {
            "event_name": "Culto sem ministerio",
            "event_type": "culto",
            "start_at": "2026-09-27T19:00:00-03:00",
            "location": "Templo",
            "schedule_name": "Escala sem ministerio",
        },
        format="json",
    )

    assert sem_ministerio.status_code == 400, sem_ministerio.data
    assert "Informe o ministerio" in str(sem_ministerio.data["ministry_id"])

