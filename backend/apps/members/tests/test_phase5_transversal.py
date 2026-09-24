import datetime

import pytest

from apps.events.models import Event
from apps.members.models import Member, MemberLinkRequest

pytestmark = pytest.mark.django_db


def test_lista_paginada_explicitamente_preserva_escopo_e_limita_tamanho(api_client, make_user, make_member, church):
    user = make_user("membro@igreja.com")
    make_member("Maria", user=user)
    for index in range(3):
        Event.objects.create(
            church=church,
            name=f"Culto {index}",
            event_type=Event.EventType.SERVICE,
            start_at=datetime.datetime(2026, 10, index + 1, 19, tzinfo=datetime.timezone.utc),
        )
    api_client.force_authenticate(user=user)

    response = api_client.get("/api/me/events/?page=2&page_size=2")

    assert response.status_code == 200
    assert response.data["count"] == 3
    assert len(response.data["results"]) == 1
    assert response.data["next"] is None
    assert response.data["previous"]


def test_eventos_aceitam_filtro_de_tipo_e_rejeitam_data_invalida(api_client, make_user, church):
    user = make_user("membro@igreja.com")
    Event.objects.create(
        church=church,
        name="Culto",
        event_type=Event.EventType.SERVICE,
        start_at=datetime.datetime(2026, 10, 1, 19, tzinfo=datetime.timezone.utc),
    )
    api_client.force_authenticate(user=user)

    response = api_client.get("/api/me/events/?event_type=culto&date_from=2026-10-01")
    invalid = api_client.get("/api/me/events/?date_from=amanha")

    assert response.status_code == 200
    assert len(response.data) == 1
    assert invalid.status_code == 400


def test_conta_sem_vinculo_pode_solicitar_revisao_sem_escolher_membro(api_client, make_user, make_member, church):
    user = make_user("novo@igreja.com")
    candidate = make_member("Novo Cadastro", email=user.email)
    api_client.force_authenticate(user=user)

    response = api_client.post("/api/me/member-link-requests/", {}, format="json")
    repeated = api_client.post("/api/me/member-link-requests/", {}, format="json")

    assert response.status_code == 201
    assert repeated.status_code == 200
    assert response.data["status"] == MemberLinkRequest.Status.PENDING
    assert MemberLinkRequest.objects.get().candidate_member == candidate
    assert candidate.user is None


def test_conta_vinculada_nao_abre_nova_solicitacao_de_vinculo(api_client, make_user, make_member):
    user = make_user("membro@igreja.com")
    make_member("Maria", user=user)
    api_client.force_authenticate(user=user)

    response = api_client.post("/api/me/member-link-requests/", {}, format="json")

    assert response.status_code == 409
