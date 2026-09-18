import datetime

import pytest

from apps.finance.models import Contribution, FinancialEntry

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
    entry = FinancialEntry.objects.get(contribution=contribution)
    assert entry.entry_type == FinancialEntry.EntryType.INCOME
    assert entry.category == FinancialEntry.Category.OFFERING
    assert entry.status == FinancialEntry.Status.PAID
    assert entry.amount == contribution.amount


def test_aceite_idempotente_nao_duplica_entrada(api_client, make_user, make_member):
    member_user = make_user("membro-idempotente@igreja.com")
    member = make_member("Membro idempotente", user=member_user)
    treasurer = make_user("tesouraria-idempotente@igreja.com", role="treasurer")
    contribution = Contribution.objects.create(
        church=member.church,
        member=member,
        category=Contribution.Category.TITHE,
        amount="120.00",
        contribution_date=datetime.date(2026, 9, 1),
    )
    api_client.force_authenticate(user=treasurer)

    first = api_client.post(f"/api/contributions/{contribution.id}/review/", {"status": Contribution.Status.APPROVED}, format="json")
    second = api_client.post(f"/api/contributions/{contribution.id}/review/", {"status": Contribution.Status.APPROVED}, format="json")

    assert first.status_code == 200
    assert second.status_code == 200
    assert FinancialEntry.objects.filter(contribution=contribution).count() == 1


def test_membro_nao_revisa_contribuicao(api_client, make_user, make_member):
    user = make_user("membro@igreja.com")
    member = make_member("Maria", user=user)
    contribution = Contribution.objects.create(church=member.church, member=member, category=Contribution.Category.OFFERING, amount="80.00", contribution_date=datetime.date(2026, 9, 1))
    api_client.force_authenticate(user=user)
    response = api_client.post(f"/api/contributions/{contribution.id}/review/", {"status": Contribution.Status.APPROVED}, format="json")
    assert response.status_code == 403
