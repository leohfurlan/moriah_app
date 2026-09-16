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
