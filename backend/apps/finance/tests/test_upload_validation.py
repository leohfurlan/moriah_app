"""Validacao de upload de comprovante de contribuicao."""
import datetime

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.finance.models import Contribution, ContributionAttachment

pytestmark = pytest.mark.django_db

CONTRIBUTIONS_URL = "/api/contributions/"

JPEG_MAGIC = b"\xff\xd8\xff\xe0"
PNG_MAGIC = b"\x89PNG\r\n\x1a\n"


@pytest.fixture
def contribuinte(api_client, make_user, make_member):
    user = make_user("contribuinte@igreja.com")
    make_member("Contribuinte", user=user)
    api_client.force_authenticate(user=user)
    return user


def _payload(file):
    return {
        "category": Contribution.Category.TITHE,
        "amount": "120.00",
        "contribution_date": "2026-07-01",
        "files": file,
    }


def test_arquivo_valido_e_aceito(api_client, contribuinte):
    arquivo = SimpleUploadedFile(
        "comprovante.jpg", JPEG_MAGIC + b"\x00" * 200, content_type="image/jpeg"
    )

    response = api_client.post(CONTRIBUTIONS_URL, _payload(arquivo), format="multipart")

    assert response.status_code == 201, response.data
    assert ContributionAttachment.objects.count() == 1


def test_extensao_invalida_e_rejeitada(api_client, contribuinte):
    arquivo = SimpleUploadedFile(
        "comprovante.txt", b"conteudo qualquer", content_type="text/plain"
    )

    response = api_client.post(CONTRIBUTIONS_URL, _payload(arquivo), format="multipart")

    assert response.status_code == 400
    assert "extensao nao permitida" in str(response.data)
    assert ContributionAttachment.objects.count() == 0
    assert Contribution.objects.count() == 0


def test_arquivo_acima_de_8mb_e_rejeitado(api_client, contribuinte):
    conteudo = JPEG_MAGIC + b"\x00" * (8 * 1024 * 1024 + 1)
    arquivo = SimpleUploadedFile("grande.jpg", conteudo, content_type="image/jpeg")

    response = api_client.post(CONTRIBUTIONS_URL, _payload(arquivo), format="multipart")

    assert response.status_code == 400
    assert "8MB" in str(response.data)
    assert ContributionAttachment.objects.count() == 0


def test_mimetype_falsificado_e_rejeitado(api_client, contribuinte):
    # Um executavel (.exe, assinatura "MZ") renomeado para .jpg.
    arquivo = SimpleUploadedFile(
        "malware.jpg", b"MZ\x90\x00" + b"\x00" * 200, content_type="image/jpeg"
    )

    response = api_client.post(CONTRIBUTIONS_URL, _payload(arquivo), format="multipart")

    assert response.status_code == 400
    assert "conteudo" in str(response.data).lower()
    assert ContributionAttachment.objects.count() == 0
    assert Contribution.objects.count() == 0


def test_png_valido_e_aceito(api_client, contribuinte):
    arquivo = SimpleUploadedFile(
        "comprovante.png", PNG_MAGIC + b"\x00" * 200, content_type="image/png"
    )

    response = api_client.post(CONTRIBUTIONS_URL, _payload(arquivo), format="multipart")

    assert response.status_code == 201, response.data
    assert ContributionAttachment.objects.count() == 1
