import datetime

import pytest

from apps.finance.models import Contribution
from apps.audit.models import AuditLog

pytestmark = pytest.mark.django_db


def test_tesoureiro_revisa_contribuicao_da_propria_igreja(api_client, make_user, make_member):
    member_user = make_user("membro@igreja.com")
    member = make_member("Maria", user=member_user)
    treasurer = make_user("tesouraria@igreja.com", role="treasurer")
    contribution = Contribution.objects.create(church=member.church, member=member, category=Contribution.Category.OFFERING, amount="80.00", contribution_date=datetime.date(2026, 9, 1))
    api_client.force_authenticate(user=treasurer)
    response = api_client.post(f"/api/contributions/{contribution.id}/review/", {"status": Contribution.Status.APPROVED, "review_notes": "Conferido"}, format="json")
    assert response.status_code == 200
    contribution.refresh_from_db()
    assert contribution.status == Contribution.Status.APPROVED
    assert contribution.reviewed_by == treasurer


def test_membro_nao_revisa_contribuicao(api_client, make_user, make_member):
    user = make_user("membro@igreja.com")
    member = make_member("Maria", user=user)
    contribution = Contribution.objects.create(church=member.church, member=member, category=Contribution.Category.OFFERING, amount="80.00", contribution_date=datetime.date(2026, 9, 1))
    api_client.force_authenticate(user=user)
    response = api_client.post(f"/api/contributions/{contribution.id}/review/", {"status": Contribution.Status.APPROVED}, format="json")
    assert response.status_code == 403

def _criar_contribuicao(member, **overrides):
    defaults = {
        "church": member.church,
        "member": member,
        "category": Contribution.Category.OFFERING,
        "amount": "80.00",
        "contribution_date": datetime.date(2026, 9, 1),
    }
    defaults.update(overrides)
    return Contribution.objects.create(**defaults)


def test_tesoureiro_lista_filtrando_status_e_periodo(api_client, make_user, make_member):
    member = make_member("Maria")
    _criar_contribuicao(member, status=Contribution.Status.PENDING, contribution_date=datetime.date(2026, 9, 1))
    aprovada = _criar_contribuicao(member, status=Contribution.Status.APPROVED, contribution_date=datetime.date(2026, 8, 1))
    treasurer = make_user("tesouraria@igreja.com", role="treasurer")
    api_client.force_authenticate(user=treasurer)

    response = api_client.get("/api/contributions/?status=approved&date_from=2026-08-01&date_to=2026-08-31")

    assert response.status_code == 200
    assert [item["id"] for item in response.data] == [aprovada.id]
    assert response.data[0]["member_name"] == "Maria"


def test_membro_nao_lista_contribuicoes_administrativas(api_client, make_user, make_member):
    user = make_user("membro@igreja.com")
    make_member("Maria", user=user)
    api_client.force_authenticate(user=user)

    response = api_client.get("/api/contributions/")

    assert response.status_code == 403


def test_rejeicao_exige_motivo_e_preserva_status(api_client, make_user, make_member):
    member = make_member("Maria")
    contribution = _criar_contribuicao(member)
    treasurer = make_user("tesouraria@igreja.com", role="treasurer")
    api_client.force_authenticate(user=treasurer)

    response = api_client.post(
        f"/api/contributions/{contribution.id}/review/",
        {"status": Contribution.Status.REJECTED},
        format="json",
    )

    assert response.status_code == 422
    contribution.refresh_from_db()
    assert contribution.status == Contribution.Status.PENDING


def test_decisao_final_idempotente_e_mudanca_posterior_bloqueada(api_client, make_user, make_member):
    member = make_member("Maria")
    contribution = _criar_contribuicao(member)
    treasurer = make_user("tesouraria@igreja.com", role="treasurer")
    api_client.force_authenticate(user=treasurer)
    url = f"/api/contributions/{contribution.id}/review/"

    primeira = api_client.post(url, {"status": Contribution.Status.APPROVED, "review_notes": "Conferido"}, format="json")
    segunda = api_client.post(url, {"status": Contribution.Status.APPROVED}, format="json")
    conflito = api_client.post(url, {"status": Contribution.Status.REJECTED, "review_notes": "Divergência"}, format="json")

    assert primeira.status_code == 200
    assert segunda.status_code == 200
    assert conflito.status_code == 409
    assert AuditLog.objects.filter(model_name="Contribution", object_id=str(contribution.id)).count() == 1


def test_detalhe_exibe_responsavel_e_historico(api_client, make_user, make_member):
    member = make_member("Maria")
    contribution = _criar_contribuicao(member)
    treasurer = make_user("tesouraria@igreja.com", role="treasurer")
    api_client.force_authenticate(user=treasurer)

    response = api_client.post(
        f"/api/contributions/{contribution.id}/review/",
        {"status": Contribution.Status.APPROVED, "review_notes": "Conferido"},
        format="json",
    )
    assert response.status_code == 200

    response = api_client.get(f"/api/contributions/{contribution.id}/")

    assert response.status_code == 200
    assert response.data["reviewed_by_name"] == "tesouraria@igreja.com"
    assert response.data["review_history"][0]["status_before"] == Contribution.Status.PENDING
    assert response.data["review_history"][0]["status_after"] == Contribution.Status.APPROVED


@pytest.mark.parametrize("initial", ["pending", "needs_review"])
@pytest.mark.parametrize("target", ["approved", "rejected"])
def test_transicoes_financeiras_e_repeticao_sem_efeito(api_client, make_user, make_member, initial, target):
    member = make_member("Maria")
    contribution = _criar_contribuicao(member, status=initial, notes="Nota do membro")
    treasurer = make_user("treasurer@church.com", role="treasurer")
    api_client.force_authenticate(user=treasurer)
    url = f"/api/contributions/{contribution.pk}/review/"
    assert api_client.post(url, {"status": target, "review_notes": "Conferido"}, format="json").status_code == 200
    contribution.refresh_from_db()
    reviewed_at = contribution.reviewed_at
    assert contribution.notes == "Nota do membro"
    assert api_client.post(url, {"status": target}, format="json").status_code == 200
    opposite = "rejected" if target == "approved" else "approved"
    assert api_client.post(url, {"status": opposite}, format="json").status_code == 409
    contribution.refresh_from_db()
    assert contribution.reviewed_at == reviewed_at
    assert contribution.review_notes == "Conferido"
    logs = AuditLog.objects.filter(model_name="Contribution", object_id=str(contribution.pk))
    assert logs.count() == 1
    assert logs.get().user == treasurer
    assert logs.get().payload == {"before": {"status": initial}, "after": {"status": target}}


@pytest.mark.parametrize("query", ["status=invalid", "date_from=no-date", "date_to=2026-02-30", "date_from=2026-09-30&date_to=2026-09-01"])
def test_filtros_invalidos(api_client, make_user, query):
    api_client.force_authenticate(user=make_user("treasurer@church.com", role="treasurer"))
    assert api_client.get(f"/api/contributions/?{query}").status_code == 400


def test_isolamento_financeiro_por_igreja(api_client, make_user, make_member):
    from apps.accounts.models import Church
    other_church = Church.objects.create(name="Outra igreja")
    from apps.members.models import Member
    other_member = Member.objects.create(full_name="Outra pessoa", church=other_church)
    contribution = _criar_contribuicao(other_member)
    api_client.force_authenticate(user=make_user("treasurer@church.com", role="treasurer"))
    assert api_client.get("/api/contributions/").data == []
    assert api_client.get(f"/api/contributions/{contribution.pk}/").status_code == 404
    assert api_client.post(f"/api/contributions/{contribution.pk}/review/", {"status": "approved"}, format="json").status_code == 404
    contribution.refresh_from_db()
    assert contribution.status == "pending"
    assert not AuditLog.objects.filter(model_name="Contribution", object_id=str(contribution.pk)).exists()


@pytest.mark.parametrize("target", ["pending", "needs_review", "invalid"])
def test_destinos_proibidos_nao_gravam_decisao(api_client, make_user, make_member, target):
    contribution = _criar_contribuicao(make_member("Maria"))
    api_client.force_authenticate(user=make_user("treasurer@church.com", role="treasurer"))
    assert api_client.post(f"/api/contributions/{contribution.pk}/review/", {"status": target}, format="json").status_code == 400
    contribution.refresh_from_db()
    assert contribution.status == "pending"
    assert contribution.reviewed_at is None


@pytest.mark.parametrize("role", ["admin", "treasurer"])
def test_revisao_com_jwt_registra_responsavel_real(api_client, make_user, make_member, role):
    from rest_framework_simplejwt.tokens import RefreshToken
    user = make_user("reviewer@church.com", role=role)
    contribution = _criar_contribuicao(make_member("Maria"))
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}")
    response = api_client.post(f"/api/contributions/{contribution.pk}/review/", {"status": "approved"}, format="json")
    assert response.status_code == 200
    assert response.data["review_history"][0]["reviewed_by_name"] == user.email
    log = AuditLog.objects.get(model_name="Contribution", object_id=str(contribution.pk))
    assert log.user == user
    assert log.church == user.church


def test_anonimo_nao_acessa_gestao_financeira(api_client):
    assert api_client.get("/api/contributions/").status_code == 401
    assert api_client.get("/api/contributions/1/").status_code == 401
    assert api_client.post("/api/contributions/1/review/", {"status": "approved"}, format="json").status_code == 401
