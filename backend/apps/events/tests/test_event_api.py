import datetime

import pytest

from apps.events.models import Event

pytestmark = pytest.mark.django_db


def test_usuario_lista_eventos_ativos_da_propria_igreja(api_client, make_user, church):
    user = make_user("membro@igreja.com")
    Event.objects.create(
        church=church,
        name="Culto de celebração",
        event_type=Event.EventType.SERVICE,
        start_at=datetime.datetime(2026, 9, 20, 19, tzinfo=datetime.timezone.utc),
        location="Templo principal",
    )
    Event.objects.create(
        church=church,
        name="Evento arquivado",
        event_type=Event.EventType.SPECIAL,
        start_at=datetime.datetime(2026, 9, 20, 19, tzinfo=datetime.timezone.utc),
        active=False,
    )

    api_client.force_authenticate(user=user)
    response = api_client.get("/api/me/events/")

    assert response.status_code == 200
    assert [item["name"] for item in response.data] == ["Culto de celebração"]
