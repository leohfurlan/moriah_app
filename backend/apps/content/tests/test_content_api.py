import pytest
from django.utils import timezone

from apps.accounts.models import User
from apps.content.models import Content


pytestmark = pytest.mark.django_db


def test_conteudo_exibe_autor_e_data_de_publicacao(api_client, make_user, church):
    pastor = make_user("pastor.conteudo@igreja.com", role=User.Role.PASTOR)
    content = Content.objects.create(
        church=church,
        author=pastor,
        title="Uma palavra",
        body="# Introdução\n\nTexto da palavra.",
        status=Content.Status.PUBLISHED,
        published_at=timezone.now(),
    )
    api_client.force_authenticate(user=pastor)

    response = api_client.get(f"/api/content/{content.id}/")

    assert response.status_code == 200
    assert response.data["author_name"] == "pastor.conteudo@igreja.com"
    assert response.data["can_manage"] is True
    assert response.data["published_at"] is not None


def test_lideranca_pode_editar_e_excluir_conteudo_publicado(api_client, make_user, church):
    pastor = make_user("pastor.editor@igreja.com", role=User.Role.PASTOR)
    content = Content.objects.create(
        church=church,
        author=pastor,
        title="Palavra publicada",
        body="Texto original.",
        status=Content.Status.PUBLISHED,
        published_at=timezone.now(),
    )
    api_client.force_authenticate(user=pastor)

    update = api_client.patch(
        f"/api/content/{content.id}/",
        {"title": "Palavra editada", "body": "Texto atualizado."},
        format="json",
    )
    deleted = api_client.delete(f"/api/content/{content.id}/")

    assert update.status_code == 200
    assert update.data["title"] == "Palavra editada"
    assert deleted.status_code == 204
    assert not Content.objects.filter(id=content.id).exists()
