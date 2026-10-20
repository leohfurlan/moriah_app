"""Public API checks. Cora fixtures synthetic, based on docs accessed 2026-10-20."""
import uuid
from unittest.mock import patch

import pytest
from cryptography.fernet import Fernet
from django.core.files.uploadedfile import SimpleUploadedFile
from apps.finance import cora
from apps.finance.models import Contribution, FinancialEntry, PixIntent, PixPayer

pytestmark = pytest.mark.django_db
URL = "/api/contributions/pix-intents/"
CPF = "52998224725"  # synthetic validation example, never sent to the bank


@pytest.fixture
def payer(api_client, make_user, make_member, settings):
    user = make_user("pix@example.test")
    member = make_member("Pagador Teste", user=user)
    api_client.force_authenticate(user=user)
    settings.CORA_ENABLED = True
    settings.CORA_CHURCH_ID = member.church_id
    settings.CORA_CLIENT_ID = "test"
    settings.CORA_CERT_PATH = "test.pem"
    settings.CORA_KEY_PATH = "test.key"
    settings.CORA_RECIPIENT_NAME = "Igreja Teste"
    settings.CORA_DATA_KEY = Fernet.generate_key().decode()
    return member


def create(api_client, key=None, **changes):
    data = {"amount": "10.00", "category": "offering", "cpf": CPF, **changes}
    return api_client.post(URL, data, format="json", HTTP_IDEMPOTENCY_KEY=str(key or uuid.uuid4()))


def response(intent):
    return {"id": "synthetic-invoice", "status": "OPEN", "total_amount": int(intent.amount * 100), "pix": {"emv": "synthetic-EMV-not-a-payment"}}


def test_generation_replay_saved_cpf_and_no_revenue(api_client, payer):
    key = uuid.uuid4()
    with patch.object(cora, "issue_pix", side_effect=response) as bank:
        first = create(api_client, key)
        assert first.status_code == 201, first.data
        assert first.data["qr_svg"] and first.data["emv"]
        assert create(api_client, key).data["id"] == first.data["id"]
        assert create(api_client, key, amount="20.00").status_code == 409
        assert bank.call_count == 1
        second = api_client.post(URL, {"amount": "5.00", "category": "tithe"}, format="json", HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4()))
        assert second.status_code == 201
    assert Contribution.objects.count() == FinancialEntry.objects.count() == 0
    assert CPF not in PixPayer.objects.get().cpf_encrypted
    assert CPF not in str(api_client.get(URL).data)
    assert not hasattr(payer, "cpf")
    assert api_client.get(URL + "config/").data["has_saved_cpf"]


@pytest.mark.parametrize("changes", [{"cpf": "11111111111"}, {"cpf": "x52998224725"}, {"amount": "4.99"}, {"amount": "10.001"}, {"church_id": 42}])
def test_validation_no_bank(api_client, payer, changes):
    with patch.object(cora, "issue_pix") as bank:
        assert create(api_client, **changes).status_code == 400
        bank.assert_not_called()
    assert PixIntent.objects.count() == 0


def test_missing_cpf_disabled_and_other_member(api_client, payer, make_user, make_member, settings):
    assert api_client.post(URL, {"amount": "10.00", "category": "offering"}, format="json", HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4())).status_code == 400
    with patch.object(cora, "issue_pix", side_effect=response):
        intent = create(api_client).data
    other = make_user("other@example.test")
    make_member("Other", user=other)
    api_client.force_authenticate(other)
    assert api_client.get(URL + intent["id"] + "/").status_code == 404
    assert api_client.get(URL).data == []
    settings.CORA_CHURCH_ID = 0
    with patch.object(cora, "issue_pix") as bank:
        assert create(api_client).status_code == 503
        bank.assert_not_called()


@pytest.mark.parametrize("result", [{}, {"id": "x", "status": "OPEN", "total_amount": 999, "pix": {"emv": "x"}}])
def test_invalid_response_remains_uncertain(api_client, payer, result):
    key = uuid.uuid4()
    with patch.object(cora, "issue_pix", return_value=result) as bank:
        first = create(api_client, key)
        assert first.status_code == 202
        assert first.data["state"] == "uncertain"
        assert not first.data["emv"]
        create(api_client, key)
        assert bank.call_count == 1


def test_timeout_preserves_intent(api_client, payer):
    with patch.object(cora, "issue_pix", side_effect=cora.CoraUnavailable):
        assert create(api_client).data["state"] == "uncertain"
    assert PixIntent.objects.count() == 1
    assert not Contribution.objects.exists()


def test_receipt_manual_approval_and_replay(api_client, payer, make_user):
    with patch.object(cora, "issue_pix", side_effect=response):
        intent = create(api_client).data
    def receipt(**changes):
        data = {"amount": "10.00", "category": "offering", "contribution_date": "2026-10-20", "pix_intent_id": intent["id"], **changes}
        return api_client.post("/api/contributions/", data, format="multipart")
    assert receipt().status_code == 400
    def file():
        return SimpleUploadedFile("receipt.jpg", b"\xff\xd8\xff\xe0" + b"0" * 200, content_type="image/jpeg")
    assert receipt(amount="20.00", files=file()).status_code == 400
    first = receipt(files=file())
    assert first.status_code == 201, first.data
    assert first.data["payment_origin"] == "cora_pix"
    assert receipt(files=file()).data["id"] == first.data["id"]
    assert Contribution.objects.count() == 1
    assert not FinancialEntry.objects.exists()
    contribution = Contribution.objects.get()
    assert contribution.attachments.count() == 1
    treasurer = make_user("treasurer@example.test", role="treasurer")
    api_client.force_authenticate(treasurer)
    for _ in range(2):
        assert api_client.post(f"/api/contributions/{contribution.pk}/review/", {"status": "approved"}, format="json").status_code == 200
    assert FinancialEntry.objects.count() == 1


def test_vencimento_does_not_expose_qr_or_cancel(api_client, payer):
    import datetime
    with patch.object(cora, "issue_pix", side_effect=response):
        intent = create(api_client).data
    with patch("apps.finance.pix_views.today", return_value=datetime.date(2099, 1, 1)):
        detail = api_client.get(URL + intent["id"] + "/").data
    assert detail["past_due"] and not detail["emv"]
    assert detail["state"] == "ready"


def test_retry_uses_original_snapshot_and_key(api_client, payer):
    with patch.object(cora, "issue_pix", side_effect=cora.CoraUnavailable):
        first = create(api_client).data
    original = PixIntent.objects.get(pk=first["id"])
    saved_key, saved_cpf = original.provider_key, original.cpf_encrypted
    PixPayer.objects.filter(member=payer).update(cpf_encrypted=cora.encrypt_cpf("11144477735"))
    with patch.object(cora, "issue_pix", side_effect=response) as bank:
        result = api_client.post(URL + first["id"] + "/retry/", {}, format="json")
        assert result.status_code == 201
        used = bank.call_args.args[0]
        assert used.provider_key == saved_key and used.cpf_encrypted == saved_cpf
        assert cora.decrypt_cpf(used.cpf_encrypted) == CPF
    assert PixIntent.objects.count() == 1


@pytest.mark.django_db(transaction=True)
def test_concurrent_generation_issues_once(api_client, payer):
    from concurrent.futures import ThreadPoolExecutor
    from django.db import connection, close_old_connections
    from rest_framework.test import APIClient
    from apps.accounts.models import User
    if connection.vendor != "postgresql":
        pytest.skip("Row locks require PostgreSQL")
    key = uuid.uuid4()
    user_id = payer.user_id
    def emit(_):
        close_old_connections()
        try:
            client = APIClient()
            client.force_authenticate(User.objects.get(pk=user_id))
            return create(client, key).status_code
        finally:
            close_old_connections()
    with patch.object(cora, "issue_pix", side_effect=response) as bank:
        with ThreadPoolExecutor(max_workers=2) as pool:
            statuses = list(pool.map(emit, range(2)))
        assert set(statuses) <= {200, 201, 202}
        assert bank.call_count == 1
    assert PixIntent.objects.count() == 1
    assert not FinancialEntry.objects.exists()


def test_adapter_transport_contract_without_network(api_client, payer):
    import io
    import json
    with patch.object(cora, "issue_pix", side_effect=response):
        create(api_client)
    intent = PixIntent.objects.get()
    sent = []
    class Opener:
        def open(self, request, timeout):
            sent.append(request)
            assert timeout == 20
            return io.BytesIO(json.dumps({"access_token": "synthetic-token"} if request.full_url.endswith("/token") else response(intent)).encode())
    with patch.object(cora.ssl, "create_default_context") as context, patch.object(cora, "build_opener", return_value=Opener()):
        assert cora.issue_pix(intent)["id"] == "synthetic-invoice"
        context.return_value.load_cert_chain.assert_called_once_with("test.pem", "test.key")
    assert len(sent) == 2
    assert sent[0].full_url == "https://matls-clients.api.stage.cora.com.br/token"
    assert b"grant_type=client_credentials" in sent[0].data
    invoice = sent[1]
    assert invoice.full_url.endswith("/v2/invoices/")
    assert invoice.get_header("Idempotency-key") == str(intent.provider_key)
    payload = json.loads(invoice.data)
    assert payload["payment_forms"] == ["PIX"]
    assert payload["customer"]["document"] == {"identity": CPF, "type": "CPF"}
    assert payload["services"][0]["amount"] == 1000
    assert payload["payment_terms"] == {"due_date": intent.due_date.isoformat()}
    assert "notification" not in payload
