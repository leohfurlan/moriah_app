import datetime

import pytest
from django.utils import timezone

from apps.events.models import Event

pytestmark = pytest.mark.django_db


def test_usuario_lista_eventos_ativos_da_propria_igreja(api_client, make_user, church):
    user = make_user("membro@igreja.com")
    # A agenda so expoe eventos de hoje em diante (com tolerancia de 1 dia), entao
    # as datas precisam ser relativas: datas fixas apodrecem e quebram o teste.
    proximo_culto = timezone.now() + datetime.timedelta(days=2)
    Event.objects.create(
        church=church,
        name="Culto de celebração",
        event_type=Event.EventType.SERVICE,
        start_at=proximo_culto,
        location="Templo principal",
    )
    Event.objects.create(
        church=church,
        name="Evento arquivado",
        event_type=Event.EventType.SPECIAL,
        start_at=proximo_culto,
        active=False,
    )

    api_client.force_authenticate(user=user)
    response = api_client.get("/api/me/events/")

    assert response.status_code == 200
    assert [item["name"] for item in response.data] == ["Culto de celebração"]
