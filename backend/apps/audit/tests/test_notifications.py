import datetime

import pytest

from apps.accounts.models import Church
from apps.audit.models import AuditLog, Notification
from apps.events.models import Event
from apps.finance.models import Contribution
from apps.ministries.models import Ministry, MinistryRole
from apps.schedules.models import Schedule, ScheduleAssignment

pytestmark = pytest.mark.django_db


def setup_schedule(make_user, make_member, status=Schedule.Status.DRAFT):
    admin = make_user("admin.rollback@igreja.com", role="admin")
    users = [make_user(f"rollback.{i}@igreja.com") for i in range(2)]
    members = [make_member(f"Membro {i}", user=user) for i, user in enumerate(users)]
    ministry = Ministry.objects.create(church=admin.church, name="Louvor")
    role = MinistryRole.objects.create(church=admin.church, ministry=ministry, name="Vocal")
    event = Event.objects.create(
        church=admin.church, name="Culto",
        start_at=datetime.datetime(2026, 9, 20, 19, tzinfo=datetime.timezone.utc),
    )
    schedule = Schedule.objects.create(
        church=admin.church, event=event, name="Escala", ministry=ministry, status=status,
    )
    return admin, schedule, members, role


def test_publicacao_falha_reverte_escala_avisos_e_auditoria_e_retry_entrega_todos(api_client, make_user, make_member, monkeypatch):
    from apps.schedules import views
    admin, schedule, members, role = setup_schedule(make_user, make_member)
    for member in members:
        ScheduleAssignment.objects.create(church=admin.church, schedule=schedule, member=member, ministry_role=role)
    notify = views.notify_schedule_assignment
    calls = []

    def fail_second(schedule, assignment):
        calls.append(assignment.pk)
        if len(calls) == 2:
            raise RuntimeError("Falha simulada de entrega")
        notify(schedule, assignment)

    monkeypatch.setattr(views, "notify_schedule_assignment", fail_second)
    api_client.force_authenticate(user=admin)
    with pytest.raises(RuntimeError, match="Falha simulada"):
        api_client.post(f"/api/schedules/{schedule.pk}/publish/")
    schedule.refresh_from_db()
    assert schedule.status == Schedule.Status.DRAFT
    assert schedule.published_at is None
    assert Notification.objects.count() == 0
    assert not AuditLog.objects.filter(action="schedule_published").exists()
    monkeypatch.setattr(views, "notify_schedule_assignment", notify)
    assert api_client.post(f"/api/schedules/{schedule.pk}/publish/").status_code == 200
    assert api_client.post(f"/api/schedules/{schedule.pk}/publish/").status_code == 200
    assert Notification.objects.count() == 2
    assert AuditLog.objects.filter(action="schedule_published").count() == 1


def test_inclusao_publicada_falha_reverte_integrante_e_retry_notifica(api_client, make_user, make_member, monkeypatch):
    from apps.schedules import views
    admin, schedule, members, role = setup_schedule(make_user, make_member, Schedule.Status.PUBLISHED)
    notify = views.notify_schedule_assignment
    def fail_delivery(*args):
        raise RuntimeError("Falha simulada")

    monkeypatch.setattr(views, "notify_schedule_assignment", fail_delivery)
    api_client.force_authenticate(user=admin)
    payload = {"member_id": members[0].pk, "ministry_role_id": role.pk}
    with pytest.raises(RuntimeError, match="Falha simulada"):
        api_client.post(f"/api/schedules/{schedule.pk}/assignments/", payload, format="json")
    assert not schedule.assignments.exists()
    assert Notification.objects.count() == 0
    assert not AuditLog.objects.filter(action="schedule_assignment_added").exists()
    monkeypatch.setattr(views, "notify_schedule_assignment", notify)
    assert api_client.post(f"/api/schedules/{schedule.pk}/assignments/", payload, format="json").status_code == 201
    assert Notification.objects.count() == 1


def test_substituicao_falha_reverte_original_substituto_notificacao_e_auditoria(
    api_client, make_user, make_member, monkeypatch,
):
    from apps.schedules import views

    admin, schedule, members, role = setup_schedule(make_user, make_member, Schedule.Status.PUBLISHED)
    original = ScheduleAssignment.objects.create(
        church=admin.church, schedule=schedule, member=members[0], ministry_role=role,
        status=ScheduleAssignment.Status.CONFIRMED,
    )
    audit = views.record_audit

    def fail_audit(*args):
        raise RuntimeError("Falha simulada na auditoria")

    monkeypatch.setattr(views, "record_audit", fail_audit)
    api_client.force_authenticate(user=admin)
    payload = {"member_id": members[1].pk, "justification": "Substituição QA"}
    url = f"/api/schedules/{schedule.pk}/assignments/{original.pk}/substitute/"
    with pytest.raises(RuntimeError, match="Falha simulada"):
        api_client.post(url, payload, format="json")
    original.refresh_from_db()
    assert original.status == ScheduleAssignment.Status.CONFIRMED
    assert schedule.assignments.count() == 1
    assert Notification.objects.count() == 0
    assert not AuditLog.objects.filter(action="schedule_substitution_created").exists()
    monkeypatch.setattr(views, "record_audit", audit)
    assert api_client.post(url, payload, format="json").status_code == 201
    original.refresh_from_db()
    assert original.status == ScheduleAssignment.Status.REPLACEMENT_NEEDED
    assert Notification.objects.filter(recipient=members[1].user).count() == 1


def test_notificacoes_isolam_destinatario_e_leitura_em_lote_e_idempotente(api_client, make_user):
    mine = make_user("notificacao.minha@igreja.com")
    other = make_user("notificacao.outra@igreja.com")
    own = Notification.objects.create(church=mine.church, recipient=mine, title="Minha", dedupe_key="qa-own")
    foreign = Notification.objects.create(church=other.church, recipient=other, title="Outra", dedupe_key="qa-other")
    other_church = Church.objects.create(name="Outra igreja QA")
    wrong_church = Notification.objects.create(
        church=other_church, recipient=mine, title="Outra igreja", dedupe_key="qa-other-church",
    )
    api_client.force_authenticate(user=mine)
    assert [item["id"] for item in api_client.get("/api/me/notifications/").data] == [own.pk]
    assert api_client.get(f"/api/me/notifications/{foreign.pk}/").status_code == 404
    assert api_client.post(f"/api/me/notifications/{foreign.pk}/read/").status_code == 404
    assert api_client.get(f"/api/me/notifications/{wrong_church.pk}/").status_code == 404
    assert api_client.post(f"/api/me/notifications/{wrong_church.pk}/read/").status_code == 404
    assert api_client.post("/api/me/notifications/mark-all-read/").data["updated"] == 1
    assert api_client.post("/api/me/notifications/mark-all-read/").data["updated"] == 0
    assert api_client.get("/api/me/notifications/unread-count/").data["count"] == 0
    own.refresh_from_db()
    foreign.refresh_from_db()
    wrong_church.refresh_from_db()
    assert own.read_at is not None
    assert foreign.read_at is None
    assert wrong_church.read_at is None


def test_publicacao_cria_notificacao_persistente_para_cada_membro(api_client, make_user, make_member):
    admin = make_user("admin.notificacao@igreja.com", role="admin")
    member_user = make_user("membro.notificacao@igreja.com")
    member = make_member("Membro avisado", user=member_user)
    ministry = Ministry.objects.create(church=admin.church, name="Louvor")
    role = MinistryRole.objects.create(church=admin.church, ministry=ministry, name="Vocal")
    event = Event.objects.create(
        church=admin.church,
        name="Culto avisado",
        start_at=datetime.datetime(2026, 9, 20, 19, tzinfo=datetime.timezone.utc),
    )
    schedule = Schedule.objects.create(
        church=admin.church, event=event, name="Escala avisada", status=Schedule.Status.DRAFT
    )
    assignment = ScheduleAssignment.objects.create(
        church=admin.church, schedule=schedule, member=member, ministry_role=role
    )
    api_client.force_authenticate(user=admin)

    assert api_client.post(f"/api/schedules/{schedule.id}/publish/").status_code == 200
    assert api_client.post(f"/api/schedules/{schedule.id}/publish/").status_code == 200
    assert Notification.objects.filter(recipient=member_user).count() == 1
    notification = Notification.objects.get(recipient=member_user)
    assert str(assignment.pk) in notification.dedupe_key

    api_client.force_authenticate(user=member_user)
    assert api_client.get("/api/me/notifications/unread-count/").data["count"] == 1
    response = api_client.post(f"/api/me/notifications/{notification.pk}/read/")
    assert response.status_code == 200
    assert response.data["is_read"] is True
    assert api_client.get("/api/me/notifications/unread-count/").data["count"] == 0


def test_revisao_de_contribuicao_notifica_o_membro(api_client, make_user, make_member):
    member_user = make_user("membro.contribuicao.notificacao@igreja.com")
    member = make_member("Membro financeiro", user=member_user)
    treasurer = make_user("tesouraria.contribuicao.notificacao@igreja.com", role="treasurer")
    contribution = Contribution.objects.create(
        church=member.church,
        member=member,
        category=Contribution.Category.OFFERING,
        amount="80.00",
        contribution_date=datetime.date(2026, 9, 17),
    )
    api_client.force_authenticate(user=treasurer)

    response = api_client.post(
        f"/api/contributions/{contribution.pk}/review/",
        {"status": Contribution.Status.APPROVED},
        format="json",
    )

    assert response.status_code == 200
    notification = Notification.objects.get(recipient=member_user)
    assert notification.category == "Contribuições"
    assert "aprovado" in notification.body
