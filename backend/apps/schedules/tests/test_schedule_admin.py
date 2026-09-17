"""Gestao de escalas (Fase 4).

Cobre a lacuna C1 (coordenador so opera o ministerio que coordena), a lacuna C3
(candidatos com conflito de agenda visivel) e o ciclo de vida exigido pelo
plano: rascunho -> publicar/cancelar, editar, adicionar/remover integrante,
substituir com historico e tudo registrado na auditoria.
"""
from datetime import datetime, timedelta

import pytest

from apps.accounts.models import Church, User
from apps.audit.models import AuditLog
from apps.events.models import Event
from apps.members.models import Member
from apps.ministries.models import Ministry, MinistryRole
from apps.schedules.models import PersonalCommitment, Schedule, ScheduleAssignment

pytestmark = pytest.mark.django_db

CULTO_19H = "2026-10-04T19:00:00-03:00"


def _em(iso: str) -> datetime:
    return datetime.fromisoformat(iso)


def _evento(church, name="Culto de Domingo", start=CULTO_19H, horas=2):
    inicio = _em(start)
    return Event.objects.create(
        church=church,
        name=name,
        event_type=Event.EventType.SERVICE,
        start_at=inicio,
        end_at=inicio + timedelta(hours=horas),
        location="Templo Sede",
    )


def _ministerio(church, name="Louvor", coordenadores=()):
    ministerio = Ministry.objects.create(church=church, name=name)
    for usuario in coordenadores:
        ministerio.coordinators.add(usuario)
    return ministerio


def _funcao(church, ministerio, name="Vocal"):
    return MinistryRole.objects.create(church=church, ministry=ministerio, name=name)


def _escala(
    church,
    event=None,
    ministry=None,
    status=Schedule.Status.DRAFT,
    name="Escala Principal",
    criado_por=None,
):
    return Schedule.objects.create(
        church=church,
        event=event or _evento(church),
        ministry=ministry,
        name=name,
        status=status,
        created_by=criado_por,
    )


def _escalado(church, schedule, member, ministry_role, status=ScheduleAssignment.Status.PENDING):
    return ScheduleAssignment.objects.create(
        church=church,
        schedule=schedule,
        member=member,
        ministry_role=ministry_role,
        status=status,
    )


def _admin_de(church, email="admin.vila@igreja.com"):
    return User.objects.create_user(
        username=email,
        email=email,
        password="senha-forte-123",
        church=church,
        role=User.Role.ADMIN,
    )


def _linhas(response):
    """Aceita lista ou resposta paginada."""
    corpo = response.data
    if isinstance(corpo, dict) and "results" in corpo:
        return corpo["results"]
    return corpo


def test_listagem_mostra_so_o_que_a_conta_administra(api_client, make_user, make_member):
    pastor = make_user("pastor.lista@igreja.com", role="pastor")
    coordenador = make_user("coord.lista@igreja.com", role="coordinator")
    outro_coordenador = make_user("coord.recepcao@igreja.com", role="coordinator")
    louvor = _ministerio(coordenador.church, "Louvor", [coordenador])
    recepcao = _ministerio(coordenador.church, "Recepcao", [outro_coordenador])
    funcao_louvor = _funcao(coordenador.church, louvor)
    do_louvor = _escala(coordenador.church, ministry=louvor, name="Escala do Louvor")
    da_recepcao = _escala(coordenador.church, ministry=recepcao, name="Escala da Recepcao")
    # Coordenador de louvor tambem enxerga escala onde ele ja escalou alguem do ministerio.
    vocalista = make_member("Vocalista do Louvor")
    _escalado(coordenador.church, da_recepcao, vocalista, funcao_louvor)

    api_client.force_authenticate(user=pastor)
    assert {linha["name"] for linha in _linhas(api_client.get("/api/schedules/"))} == {
        "Escala do Louvor",
        "Escala da Recepcao",
    }

    api_client.force_authenticate(user=coordenador)
    assert {linha["name"] for linha in _linhas(api_client.get("/api/schedules/"))} == {
        "Escala do Louvor",
        "Escala da Recepcao",
    }

    api_client.force_authenticate(user=outro_coordenador)
    assert [linha["name"] for linha in _linhas(api_client.get("/api/schedules/"))] == ["Escala da Recepcao"]

    # Sem integrante do ministerio na escala alheia, o escopo volta a ser so o proprio.
    da_recepcao.assignments.all().delete()
    api_client.force_authenticate(user=coordenador)
    assert [linha["name"] for linha in _linhas(api_client.get("/api/schedules/"))] == ["Escala do Louvor"]
    assert do_louvor.ministry_id == louvor.id


def test_detalhe_e_acoes_exigem_escopo_e_nao_atravessam_igreja(api_client, make_user):
    coordenador = make_user("coord.escopo@igreja.com", role="coordinator")
    _ministerio(coordenador.church, "Louvor", [coordenador])
    recepcao = _ministerio(coordenador.church, "Recepcao")
    da_recepcao = _escala(coordenador.church, ministry=recepcao, name="Escala da Recepcao")
    api_client.force_authenticate(user=coordenador)

    assert api_client.get(f"/api/schedules/{da_recepcao.id}/").status_code == 403
    assert api_client.get(f"/api/schedules/{da_recepcao.id}/candidates/").status_code == 403
    assert api_client.patch(f"/api/schedules/{da_recepcao.id}/", {"name": "invasao"}, format="json").status_code == 403
    assert api_client.post(f"/api/schedules/{da_recepcao.id}/publish/").status_code == 403
    assert api_client.post(f"/api/schedules/{da_recepcao.id}/cancel/").status_code == 403
    assert (
        api_client.post(
            f"/api/schedules/{da_recepcao.id}/assignments/",
            {"member_id": 1, "ministry_role_id": 1},
            format="json",
        ).status_code
        == 403
    )

    outra_igreja = Church.objects.create(name="Igreja Vila Nova")
    api_client.force_authenticate(user=_admin_de(outra_igreja))
    assert api_client.get(f"/api/schedules/{da_recepcao.id}/").status_code == 404

    membro_comum = make_user("membro.gestao@igreja.com", role="member")
    api_client.force_authenticate(user=membro_comum)
    assert api_client.get("/api/schedules/").status_code == 403
    assert api_client.get("/api/ministries/").status_code == 403


def test_detalhe_traz_funcoes_equipe_e_contagem(api_client, make_user, make_member):
    gestor = make_user("gestor.detalhe@igreja.com", role="admin")
    ministerio = _ministerio(gestor.church, "Louvor")
    vocal = _funcao(gestor.church, ministerio, "Vocal")
    bateria = _funcao(gestor.church, ministerio, "Bateria")
    escala = _escala(gestor.church, ministry=ministerio, criado_por=gestor)
    ana = make_member("Ana Vocal")
    bruno = make_member("Bruno Baterista")
    _escalado(gestor.church, escala, ana, vocal, status=ScheduleAssignment.Status.CONFIRMED)
    _escalado(gestor.church, escala, bruno, bateria)

    api_client.force_authenticate(user=gestor)
    response = api_client.get(f"/api/schedules/{escala.id}/")

    assert response.status_code == 200
    assert response.data["ministry_name"] == "Louvor"
    assert [funcao["name"] for funcao in response.data["ministry_roles"]] == ["Bateria", "Vocal"]
    assert [linha["member_name"] for linha in response.data["team"]] == ["Bruno Baterista", "Ana Vocal"]
    assert response.data["counts"]["total"] == 2
    assert response.data["counts"][ScheduleAssignment.Status.CONFIRMED] == 1
    assert response.data["counts"][ScheduleAssignment.Status.PENDING] == 1
    assert response.data["can_publish"] is True
    assert response.data["can_cancel"] is True


def test_edicao_altera_escala_e_evento_e_bloqueia_cancelada(api_client, make_user):
    admin = make_user("admin.edicao@igreja.com", role="admin")
    escala = _escala(admin.church)
    api_client.force_authenticate(user=admin)

    response = api_client.patch(
        f"/api/schedules/{escala.id}/",
        {
            "name": "Escala Revisada",
            "notes": "Chegar 18h30",
            "event_start_at": "2026-10-04T18:30:00-03:00",
            "event_location": "Templo Central",
        },
        format="json",
    )

    assert response.status_code == 200, response.data
    escala.refresh_from_db()
    assert escala.name == "Escala Revisada"
    assert escala.notes == "Chegar 18h30"
    assert escala.event.start_at == _em("2026-10-04T18:30:00-03:00")
    assert escala.event.location == "Templo Central"

    escala.status = Schedule.Status.CANCELLED
    escala.save(update_fields=["status"])

    cancelada = api_client.patch(f"/api/schedules/{escala.id}/", {"name": "Tarde demais"}, format="json")
    assert cancelada.status_code == 409
    escala.refresh_from_db()
    assert escala.name == "Escala Revisada"


def test_publicacao_exige_integrante_e_e_idempotente(api_client, make_user, make_member):
    admin = make_user("admin.publica@igreja.com", role="admin")
    ministerio = _ministerio(admin.church, "Louvor")
    funcao = _funcao(admin.church, ministerio)
    escala = _escala(admin.church, ministry=ministerio)
    api_client.force_authenticate(user=admin)

    vazio = api_client.post(f"/api/schedules/{escala.id}/publish/")
    assert vazio.status_code == 400
    assert "ao menos um integrante" in str(vazio.data["detail"])

    _escalado(admin.church, escala, make_member("Escalado"), funcao)
    primeiro = api_client.post(f"/api/schedules/{escala.id}/publish/")
    assert primeiro.status_code == 200, primeiro.data
    assert primeiro.data["status"] == Schedule.Status.PUBLISHED
    escala.refresh_from_db()
    momento = escala.published_at
    assert momento is not None

    segundo = api_client.post(f"/api/schedules/{escala.id}/publish/")
    assert segundo.status_code == 200
    escala.refresh_from_db()
    assert escala.published_at == momento
    assert AuditLog.objects.filter(action="schedule_published", object_id=str(escala.id)).count() == 1


def test_cancelamento_e_idempotente_e_bloqueia_publicacao(api_client, make_user):
    admin = make_user("admin.cancela@igreja.com", role="admin")
    escala = _escala(admin.church, status=Schedule.Status.PUBLISHED)
    api_client.force_authenticate(user=admin)

    primeiro = api_client.post(f"/api/schedules/{escala.id}/cancel/")
    assert primeiro.status_code == 200, primeiro.data
    assert primeiro.data["status"] == Schedule.Status.CANCELLED
    assert primeiro.data["can_publish"] is False

    repetido = api_client.post(f"/api/schedules/{escala.id}/cancel/")
    assert repetido.status_code == 200
    assert repetido.data["status"] == Schedule.Status.CANCELLED

    assert api_client.post(f"/api/schedules/{escala.id}/publish/").status_code == 400
    assert (
        api_client.post(
            f"/api/schedules/{escala.id}/assignments/",
            {"member_id": 1, "ministry_role_id": 1},
            format="json",
        ).status_code
        == 409
    )


def test_membro_so_ve_escala_publicada(api_client, make_user, make_member):
    gestor = make_user("gestor.visao@igreja.com", role="admin")
    usuario = make_user("membro.visao@igreja.com")
    membro = make_member("Membro Visao", user=usuario)
    ministerio = _ministerio(gestor.church, "Louvor")
    funcao = _funcao(gestor.church, ministerio)
    escala = _escala(gestor.church, ministry=ministerio)

    api_client.force_authenticate(user=usuario)
    assert _linhas(api_client.get("/api/me/schedules/")) == []

    _escalado(gestor.church, escala, membro, funcao)
    api_client.force_authenticate(user=gestor)
    api_client.post(f"/api/schedules/{escala.id}/publish/")

    api_client.force_authenticate(user=usuario)
    publicada = _linhas(api_client.get("/api/me/schedules/"))
    assert [linha["schedule"] for linha in publicada] == [escala.id]

    api_client.force_authenticate(user=gestor)
    api_client.post(f"/api/schedules/{escala.id}/cancel/")
    api_client.force_authenticate(user=usuario)
    assert _linhas(api_client.get("/api/me/schedules/")) == []


def test_candidatos_trazem_conflito_e_nao_vazam_outra_igreja(api_client, make_user, make_member):
    gestor = make_user("gestor.candidatos@igreja.com", role="admin")
    ministerio = _ministerio(gestor.church, "Louvor")
    funcao = _funcao(gestor.church, ministerio)
    ana = make_member("Ana do Louvor")
    ministerio.members.add(ana)
    make_member("Bruno Livre")
    carlos = make_member("Carlos Ocupado")
    make_member("Dora Inativa", status=Member.Status.INACTIVE)

    ensaio = _evento(gestor.church, name="Ensaio Geral", start="2026-10-04T18:00:00-03:00", horas=3)
    escala_do_ensaio = _escala(gestor.church, event=ensaio, ministry=ministerio, name="Escala do Ensaio")
    _escalado(gestor.church, escala_do_ensaio, carlos, funcao)
    escala = _escala(gestor.church, ministry=ministerio, name="Escala do Culto")

    outra_igreja = Church.objects.create(name="Igreja Vila Nova")
    Member.objects.create(church=outra_igreja, full_name="Forasteiro")

    api_client.force_authenticate(user=gestor)
    response = api_client.get(f"/api/schedules/{escala.id}/candidates/")

    assert response.status_code == 200
    linhas = _linhas(response)
    por_nome = {linha["full_name"]: linha for linha in linhas}
    assert "Dora Inativa" not in por_nome
    assert "Forasteiro" not in por_nome
    assert linhas[0]["full_name"] == "Ana do Louvor"
    assert por_nome["Ana do Louvor"]["ministry_names"] == ["Louvor"]
    assert por_nome["Bruno Livre"]["available"] is True
    assert por_nome["Carlos Ocupado"]["available"] is False
    assert "Ja escalado em Escala do Ensaio" in por_nome["Carlos Ocupado"]["conflict_reason"]


def test_escala_cancelada_nao_bloqueia_nova_disponibilidade(api_client, make_user, make_member):
    gestor = make_user("gestor.cancelada.conflito@igreja.com", role="admin")
    ministerio = _ministerio(gestor.church, "Louvor")
    funcao = _funcao(gestor.church, ministerio)
    membro = make_member("Livre apos cancelamento")
    cancelada = _escala(
        gestor.church,
        event=_evento(gestor.church, name="Culto cancelado"),
        ministry=ministerio,
        status=Schedule.Status.CANCELLED,
        name="Escala cancelada",
    )
    _escalado(gestor.church, cancelada, membro, funcao)
    nova = _escala(
        gestor.church,
        event=_evento(gestor.church, name="Culto novo"),
        ministry=ministerio,
        name="Escala nova",
    )
    api_client.force_authenticate(user=gestor)

    candidatos = _linhas(api_client.get(f"/api/schedules/{nova.id}/candidates/"))
    candidato = next(item for item in candidatos if item["id"] == membro.id)
    assert candidato["available"] is True
    assert candidato["conflict_reason"] == ""

    response = api_client.post(
        f"/api/schedules/{nova.id}/assignments/",
        {"member_id": membro.id, "ministry_role_id": funcao.id},
        format="json",
    )
    assert response.status_code == 201, response.data
    assert response.data["status"] == ScheduleAssignment.Status.PENDING
def test_adicionar_integrante_valida_igreja_funcao_e_duplicidade(api_client, make_user, make_member):
    gestor = make_user("gestor.adiciona@igreja.com", role="admin")
    ministerio = _ministerio(gestor.church, "Louvor")
    vocal = _funcao(gestor.church, ministerio, "Vocal")
    recepcao = _ministerio(gestor.church, "Recepcao")
    porta = _funcao(gestor.church, recepcao, "Porta")
    escala = _escala(gestor.church, ministry=ministerio)
    membro = make_member("Vocalista Um")
    api_client.force_authenticate(user=gestor)
    url = f"/api/schedules/{escala.id}/assignments/"

    criado = api_client.post(url, {"member_id": membro.id, "ministry_role_id": vocal.id}, format="json")
    assert criado.status_code == 201, criado.data
    assert criado.data["status"] == ScheduleAssignment.Status.PENDING
    assert criado.data["member_name"] == "Vocalista Um"
    assert criado.data["role_name"] == "Vocal"
    assert criado.data["ministry_name"] == "Louvor"

    duplicado = api_client.post(url, {"member_id": membro.id, "ministry_role_id": vocal.id}, format="json")
    assert duplicado.status_code == 409
    assert "ja esta escalado" in str(duplicado.data["detail"])

    funcao_de_outro = api_client.post(url, {"member_id": membro.id, "ministry_role_id": porta.id}, format="json")
    assert funcao_de_outro.status_code == 400
    assert "pertence ao ministerio" in str(funcao_de_outro.data["ministry_role_id"])

    outra_igreja = Church.objects.create(name="Igreja Vila Nova")
    de_fora = Member.objects.create(church=outra_igreja, full_name="De Fora")
    estranho = api_client.post(url, {"member_id": de_fora.id, "ministry_role_id": vocal.id}, format="json")
    assert estranho.status_code == 400
    assert "Membro nao encontrado" in str(estranho.data["member_id"])


def test_integrante_com_compromisso_pessoal_entra_marcado_como_conflito(api_client, make_user, make_member):
    gestor = make_user("gestor.conflito@igreja.com", role="admin")
    ministerio = _ministerio(gestor.church, "Louvor")
    funcao = _funcao(gestor.church, ministerio)
    escala = _escala(gestor.church, ministry=ministerio)
    membro = make_member("Membro Ocupado")
    PersonalCommitment.objects.create(
        church=gestor.church,
        member=membro,
        title="Consulta medica",
        starts_at=_em("2026-10-04T19:30:00-03:00"),
    )

    api_client.force_authenticate(user=gestor)
    response = api_client.post(
        f"/api/schedules/{escala.id}/assignments/",
        {"member_id": membro.id, "ministry_role_id": funcao.id},
        format="json",
    )

    assert response.status_code == 201, response.data
    assert response.data["status"] == ScheduleAssignment.Status.CONFLICT
    assert "Consulta medica" in response.data["conflict_reason"]


def test_substituicao_gera_historico_e_remocao_devolve_original(api_client, make_user, make_member):
    gestor = make_user("gestor.substitui@igreja.com", role="admin")
    ministerio = _ministerio(gestor.church, "Louvor")
    funcao = _funcao(gestor.church, ministerio)
    escala = _escala(gestor.church, ministry=ministerio, status=Schedule.Status.PUBLISHED)
    original = _escalado(
        gestor.church, escala, make_member("Integrante Original"), funcao, status=ScheduleAssignment.Status.CONFIRMED
    )
    substituto = make_member("Integrante Substituto")
    api_client.force_authenticate(user=gestor)

    response = api_client.post(
        f"/api/schedules/{escala.id}/assignments/{original.id}/substitute/",
        {"member_id": substituto.id, "justification": "Viagem"},
        format="json",
    )

    assert response.status_code == 201, response.data
    original.refresh_from_db()
    assert original.status == ScheduleAssignment.Status.REPLACEMENT_NEEDED
    assert original.justification == "Viagem"

    detalhe = api_client.get(f"/api/schedules/{escala.id}/").data
    historico = detalhe["substitutions"]
    assert len(historico) == 1
    assert historico[0]["original_member_name"] == "Integrante Original"
    assert historico[0]["replacement_member_name"] == "Integrante Substituto"
    assert historico[0]["role_name"] == "Vocal"
    assert historico[0]["justification"] == "Viagem"

    bloqueado = api_client.delete(f"/api/schedules/{escala.id}/assignments/{original.id}/")
    assert bloqueado.status_code == 409
    assert "substituicao vinculada" in str(bloqueado.data["detail"])

    removido = api_client.delete(f"/api/schedules/{escala.id}/assignments/{response.data['id']}/")
    assert removido.status_code == 204
    original.refresh_from_db()
    assert original.status == ScheduleAssignment.Status.PENDING
    assert original.justification == ""

    api_client.force_authenticate(user=gestor)
    assert api_client.get(f"/api/schedules/{escala.id}/").data["substitutions"] == []


def test_substituicao_rejeita_funcao_de_outro_ministerio_sem_mutar_original(api_client, make_user, make_member):
    gestor = make_user("gestor.substitui.ministerio@igreja.com", role="admin")
    louvor = _ministerio(gestor.church, "Louvor")
    vocal = _funcao(gestor.church, louvor, "Vocal")
    recepcao = _ministerio(gestor.church, "Recepcao")
    porta = _funcao(gestor.church, recepcao, "Porta")
    escala = _escala(gestor.church, ministry=louvor, status=Schedule.Status.PUBLISHED)
    original = _escalado(gestor.church, escala, make_member("Original protegido"), vocal)
    substituto = make_member("Substituto invalido")
    api_client.force_authenticate(user=gestor)

    response = api_client.post(
        f"/api/schedules/{escala.id}/assignments/{original.id}/substitute/",
        {"member_id": substituto.id, "ministry_role_id": porta.id},
        format="json",
    )

    assert response.status_code == 400, response.data
    assert "pertence ao ministerio" in str(response.data["ministry_role_id"])
    original.refresh_from_db()
    assert original.status == ScheduleAssignment.Status.PENDING
    assert original.justification == ""
    assert not ScheduleAssignment.objects.filter(substitution_for=original).exists()
def test_ciclo_da_escala_gera_auditoria(api_client, make_user, make_member):
    admin = make_user("admin.auditoria@igreja.com", role="admin")
    ministerio = _ministerio(admin.church, "Louvor")
    funcao = _funcao(admin.church, ministerio)
    membro = make_member("Membro Auditado")
    api_client.force_authenticate(user=admin)

    criada = api_client.post(
        "/api/schedules/",
        {
            "event_name": "Culto Auditado",
            "event_type": "culto",
            "start_at": "2026-10-04T19:00:00-03:00",
            "location": "Templo",
            "schedule_name": "Escala Auditada",
            "ministry_id": ministerio.id,
            "assignments": [{"member_id": membro.id, "ministry_role_id": funcao.id}],
        },
        format="json",
    )
    assert criada.status_code == 201, criada.data
    escala_id = criada.data["id"]
    assert criada.data["counts"]["total"] == 1
    assert criada.data["ministry"] == ministerio.id

    api_client.post(f"/api/schedules/{escala_id}/publish/")
    api_client.post(f"/api/schedules/{escala_id}/cancel/")

    acoes = set(
        AuditLog.objects.filter(model_name="Schedule", object_id=str(escala_id)).values_list("action", flat=True)
    )
    assert {"schedule_created", "schedule_published", "schedule_cancelled"} <= acoes


def test_lista_de_ministerios_respeita_o_papel(api_client, make_user):
    pastor = make_user("pastor.ministerios@igreja.com", role="pastor")
    coordenador = make_user("coord.ministerios@igreja.com", role="coordinator")
    louvor = _ministerio(coordenador.church, "Louvor", [coordenador])
    _funcao(coordenador.church, louvor, "Vocal")
    _ministerio(coordenador.church, "Recepcao")

    api_client.force_authenticate(user=pastor)
    corpo = _linhas(api_client.get("/api/ministries/"))
    assert {ministerio["name"] for ministerio in corpo} == {"Louvor", "Recepcao"}
    louvor_payload = next(ministerio for ministerio in corpo if ministerio["name"] == "Louvor")
    assert [funcao["name"] for funcao in louvor_payload["roles"]] == ["Vocal"]
    assert louvor_payload["coordinator_names"] == [coordenador.email]

    api_client.force_authenticate(user=coordenador)
    assert {ministerio["name"] for ministerio in _linhas(api_client.get("/api/ministries/"))} == {"Louvor"}
