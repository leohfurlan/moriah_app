import datetime

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.accounts.models import User
from apps.events.models import Event, EventAnnouncement


pytestmark = pytest.mark.django_db


def image_file(name="folder.jpg"):
    if name.endswith(".png"):
        content = b"\x89PNG\r\n\x1a\n" + b"valid-png"
    else:
        content = b"\xff\xd8\xff\xe0" + b"valid-jpeg"
    return SimpleUploadedFile(name, content, content_type="image/jpeg")


def make_event(church, name="Conferência Moriah"):
    return Event.objects.create(
        church=church,
        name=name,
        event_type=Event.EventType.CONFERENCE,
        start_at=datetime.datetime(2026, 10, 1, 19, tzinfo=datetime.timezone.utc),
        location="Templo principal",
        description="Detalhes da conferência.",
    )


def test_membro_lista_apenas_avisos_ativos(api_client, make_user, church):
    member = make_user("membro-avisos@igreja.com")
    event = make_event(church)
    EventAnnouncement.objects.create(church=church, event=event, image=image_file(), position=1)
    EventAnnouncement.objects.create(church=church, event=event, image=image_file("oculto.jpg"), position=2, active=False)

    api_client.force_authenticate(user=member)
    response = api_client.get("/api/event-announcements/")

    assert response.status_code == 200
    assert len(response.data) == 1
    assert response.data[0]["event"] == event.id
    assert response.data[0]["image_url"]


def test_coordenador_cria_folder_vinculado_ao_evento(api_client, make_user, church):
    coordinator = make_user("coordenador-avisos@igreja.com", role=User.Role.COORDINATOR)
    event = make_event(church)

    api_client.force_authenticate(user=coordinator)
    response = api_client.post(
        "/api/event-announcements/",
        {"event": event.id, "title": "Inscrições abertas", "position": 1, "image": image_file()},
        format="multipart",
    )

    assert response.status_code == 201
    announcement = EventAnnouncement.objects.get()
    assert announcement.created_by_id == coordinator.id
    assert announcement.church_id == church.id
    assert announcement.event_id == event.id


def test_membro_nao_pode_editar_carrossel(api_client, make_user, church):
    member = make_user("membro-sem-gestao@igreja.com")
    event = make_event(church)

    api_client.force_authenticate(user=member)
    response = api_client.post(
        "/api/event-announcements/",
        {"event": event.id, "position": 1, "image": image_file()},
        format="multipart",
    )

    assert response.status_code == 403


def test_carrossel_rejeita_posicao_fora_do_limite(api_client, make_user, church):
    manager = make_user("admin-avisos@igreja.com", role=User.Role.ADMIN)
    event = make_event(church)

    api_client.force_authenticate(user=manager)
    response = api_client.post(
        "/api/event-announcements/",
        {"event": event.id, "position": 5, "image": image_file()},
        format="multipart",
    )

    assert response.status_code == 400
    assert "position" in response.data
