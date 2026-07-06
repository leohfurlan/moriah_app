"""Isolamento do extrato: um membro nao acessa contribuicoes de outro."""
import datetime

import pytest
from rest_framework.test import APIRequestFactory

from apps.finance.models import Contribution
from apps.finance.views import ContributionViewSet

pytestmark = pytest.mark.django_db

STATEMENT_URL = "/api/me/statement/"


@pytest.fixture
def cenario(make_user, make_member):
    """Dois membros (A e B), cada um com uma contribuicao propria."""
    user_a = make_user(email="membro.a@igreja.com")
    user_b = make_user(email="membro.b@igreja.com")
    member_a = make_member("Membro A", user=user_a)
    member_b = make_member("Membro B", user=user_b)

    contrib_a = Contribution.objects.create(
        church=member_a.church,
        member=member_a,
        category=Contribution.Category.TITHE,
        amount="100.00",
        contribution_date=datetime.date(2026, 7, 1),
    )
    contrib_b = Contribution.objects.create(
        church=member_b.church,
        member=member_b,
        category=Contribution.Category.OFFERING,
        amount="250.00",
        contribution_date=datetime.date(2026, 7, 2),
    )
    return {
        "user_a": user_a,
        "user_b": user_b,
        "contrib_a": contrib_a,
        "contrib_b": contrib_b,
    }


def test_extrato_lista_apenas_contribuicoes_do_proprio_membro(api_client, cenario):
    api_client.force_authenticate(user=cenario["user_a"])

    response = api_client.get(STATEMENT_URL)

    assert response.status_code == 200
    ids = {item["id"] for item in response.data}
    assert ids == {cenario["contrib_a"].id}
    assert cenario["contrib_b"].id not in ids


def test_membro_nao_acessa_contribuicao_de_outro_no_queryset(cenario):
    # A API nao expoe rota de detalhe de contribuicao; o unico ponto de leitura
    # e o queryset da viewset, que e sempre filtrado pelo membro autenticado.
    # Aqui garantimos que a contribuicao de B jamais entra no queryset de A.
    factory = APIRequestFactory()
    request = factory.get("/api/contributions/")
    request.user = cenario["user_a"]

    view = ContributionViewSet()
    view.request = request
    queryset = view.get_queryset()

    assert cenario["contrib_a"] in queryset
    assert cenario["contrib_b"] not in queryset
