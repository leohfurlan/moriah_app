import pytest
from rest_framework.test import APIClient, APIRequestFactory

from apps.accounts.models import Church, User, WhatsAppIdentity
from apps.accounts.talk2me_views import Talk2meContactsView

pytestmark = pytest.mark.django_db
TOKEN = "synthetic-directory-token-for-test-only"
PHONE = "+5511999990001"


@pytest.fixture
def directory(monkeypatch):
    church = Church.objects.create(name="Synthetic A")
    other = Church.objects.create(name="Synthetic B")
    user = User.objects.create(username="alice", email="alice@example.invalid",
                               first_name="Alice", church=church)
    second = User.objects.create(username="bob", email="bob@example.invalid",
                                 first_name="Bob", church=other)
    WhatsAppIdentity.objects.create(user=user, church=church, phone=PHONE)
    WhatsAppIdentity.objects.create(user=second, church=other, phone=PHONE)
    monkeypatch.setenv("TALK2ME_DIRECTORY_TOKEN", TOKEN)
    monkeypatch.setenv("TALK2ME_DIRECTORY_CHURCH_ID", str(church.pk))
    return church, other, user


def call(scope, phones=None, token=TOKEN):
    request = APIRequestFactory().post("/contacts/resolve/",
        {"scope_ref": str(scope), "phones": phones if phones is not None else [PHONE]},
        format="json", HTTP_AUTHORIZATION="Bearer " + token)
    return Talk2meContactsView.as_view()(request)


def test_scope_and_revocation(directory):
    church, other, user = directory
    result = call(church.pk)
    assert result.status_code == 200
    assert result.data["items"][0]["display_name"] == "Alice"
    assert "Bob" not in str(result.data)
    assert result["Cache-Control"] == "no-store"
    assert call(other.pk).status_code == 403
    WhatsAppIdentity.objects.filter(user=user).delete()
    assert call(church.pk).data["items"][0]["status"] == "unknown"


def test_credentials_and_malformed_inputs(directory, monkeypatch):
    church, _, _ = directory
    assert call(church.pk, token="bad").status_code == 401
    for phones in [[PHONE, PHONE], ["invalid"], [], [PHONE] * 101]:
        assert call(church.pk, phones).status_code == 422
    monkeypatch.delenv("TALK2ME_DIRECTORY_TOKEN")
    assert call(church.pk).status_code == 401


def test_inactive_or_moved_user_is_not_identified(directory):
    church, other, user = directory
    user.church = other
    user.save(update_fields=["church"])
    assert call(church.pk).data["items"][0]["status"] == "unknown"
    user.church = church
    user.is_active = False
    user.save(update_fields=["church", "is_active"])
    assert call(church.pk).data["items"][0]["status"] == "unknown"


def test_routed_contract_with_production_onboarding_guard(directory, settings):
    church, _, _ = directory
    settings.ONBOARDING_REQUIRED = True
    client = APIClient()
    path = "/backend/integrations/talk2me/contacts/resolve/"
    assert client.post(path, {}, format="json").status_code == 401
    response = client.post(path, {"scope_ref": str(church.pk), "phones": [PHONE]},
                           format="json", HTTP_AUTHORIZATION="Bearer " + TOKEN)
    assert response.status_code == 200
    assert response.json()["items"][0]["display_name"] == "Alice"
