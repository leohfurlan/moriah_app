import pytest

from apps.events.models import Event
from apps.schedules.models import Schedule

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
            "status": "published",
        },
        format="json",
    )

    assert response.status_code == 201
    assert Event.objects.filter(name="Culto especial", church=admin.church).exists()
    assert Schedule.objects.filter(name="Escala culto especial", church=admin.church, status=Schedule.Status.PUBLISHED).exists()
