import datetime

import pytest

from apps.finance.models import Contribution

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