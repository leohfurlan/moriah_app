import pytest

from apps.schedules.models import PersonalCommitment

pytestmark = pytest.mark.django_db


def _payload():
    return {
        "title": "Ensaio do Louvor",
        "starts_at": "2026-12-20T18:00:00-03:00",
        "ends_at": "2026-12-20T20:00:00-03:00",
    }


def test_membro_comum_nao_cria_compromisso_mas_le_a_propria_agenda(api_client, make_user, make_member):
    """Compromisso na agenda e da lideranca (decisao de produto).

    O membro comum continua lendo a propria agenda — o que muda e a escrita.
    """
    user = make_user("membro.agenda@igreja.com")
    make_member("Membro comum", user=user)
    api_client.force_authenticate(user=user)

    response = api_client.post("/api/me/agenda/", _payload(), format="json")

    assert response.status_code == 403
    assert PersonalCommitment.objects.count() == 0
    assert api_client.get("/api/me/agenda/").status_code == 200


@pytest.mark.parametrize("papel", ["coordinator", "cell_leader", "pastor", "admin"])
def test_lideranca_de_ministerio_ou_celula_cria_compromisso(api_client, make_user, make_member, papel):
    """Coordenacao (lider de ministerio), lider de celula, pastor e admin criam."""
    user = make_user(f"{papel}.agenda@igreja.com", role=papel)
    make_member(f"Lider {papel}", user=user)
    api_client.force_authenticate(user=user)

    response = api_client.post("/api/me/agenda/", _payload(), format="json")

    assert response.status_code == 201
    assert PersonalCommitment.objects.filter(member__user=user).count() == 1


def test_lideranca_sem_vinculo_de_membro_nao_cria(api_client, make_user):
    """Sem cadastro de membro nao existe agenda pessoal para gravar (o membro e obrigatorio)."""
    user = make_user("coordenacao.sem.membro@igreja.com", role="coordinator")
    api_client.force_authenticate(user=user)

    response = api_client.post("/api/me/agenda/", _payload(), format="json")

    assert response.status_code == 403
    assert PersonalCommitment.objects.count() == 0
