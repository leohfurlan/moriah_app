import datetime

import pytest

from apps.finance.models import FinancialEntry
from apps.finance.models import Contribution

pytestmark = pytest.mark.django_db


def test_gestor_financeiro_cria_lancamento_e_isola_por_igreja(api_client, make_user, church):
    gestor = make_user("tesoureiro@igreja.com", role="treasurer")
    api_client.force_authenticate(user=gestor)

    response = api_client.post(
        "/api/finance/entries/",
        {
            "entry_type": "expense",
            "category": "utilities",
            "description": "Internet",
            "amount": "189.90",
            "due_date": "2026-10-10",
            "status": "scheduled",
        },
        format="json",
    )

    assert response.status_code == 201
    assert FinancialEntry.objects.filter(church=church, description="Internet").exists()
    assert response.data["status_display"] == "Agendado"


def test_gestor_nao_cria_entrada_manual(api_client, make_user):
    gestor = make_user("tesoureiro-sem-entrada@igreja.com", role="treasurer")
    api_client.force_authenticate(user=gestor)

    response = api_client.post(
        "/api/finance/entries/",
        {
            "entry_type": "income",
            "category": "offering",
            "description": "Oferta manual",
            "amount": "50.00",
            "due_date": "2026-10-10",
        },
        format="json",
    )

    assert response.status_code == 400
    assert "entry_type" in response.data


def test_membro_nao_acessa_livro_financeiro(api_client, make_user):
    user = make_user("membro@igreja.com")
    api_client.force_authenticate(user=user)
    assert api_client.get("/api/finance/entries/").status_code == 403


def test_atualizar_para_pago_registra_data(api_client, make_user, church):
    gestor = make_user("pastor@igreja.com", role="pastor")
    entry = FinancialEntry.objects.create(
        church=church,
        entry_type=FinancialEntry.EntryType.EXPENSE,
        category=FinancialEntry.Category.CARD,
        description="Parcela do cartão",
        amount="500.00",
        due_date=datetime.date(2026, 10, 15),
    )
    api_client.force_authenticate(user=gestor)
    response = api_client.patch(f"/api/finance/entries/{entry.id}/", {"status": "paid"}, format="json")
    assert response.status_code == 200
    entry.refresh_from_db()
    assert entry.paid_at is not None


def test_gestor_visualiza_contribuicoes_da_igreja_para_aceite(api_client, make_user, make_member):
    member_user = make_user("membro.oferta@igreja.com")
    member = make_member("Membro da oferta", user=member_user)
    gestor = make_user("pastor.ofertas@igreja.com", role="pastor")
    contribution = Contribution.objects.create(
        church=member.church,
        member=member,
        category=Contribution.Category.OFFERING,
        amount="75.00",
        contribution_date=datetime.date(2026, 10, 1),
    )
    api_client.force_authenticate(user=gestor)
    response = api_client.get("/api/contributions/")
    assert response.status_code == 200
    assert response.data[0]["id"] == contribution.id
    assert response.data[0]["member_name"] == "Membro da oferta"
