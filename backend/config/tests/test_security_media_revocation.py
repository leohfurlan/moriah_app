import pytest
from rest_framework.test import APIRequestFactory
from rest_framework_simplejwt.tokens import AccessToken
from .test_private_media import receipt, local_private_storage
from apps.accounts.sessions import issue_session
from config.private_media import private_file_url

pytestmark = pytest.mark.django_db(transaction=True)


def test_signed_link_revoked_on_logout(api_client, receipt):
    user, attachment = receipt
    tokens = issue_session(user)
    request = APIRequestFactory().get("/", secure=True)
    request.user = user
    request.auth = AccessToken(tokens["access"])
    url = private_file_url(request, "contribution", attachment)
    response = api_client.get(url)
    assert response.status_code == 200
    response.close()
    assert api_client.post("/api/auth/logout/", {"refresh": tokens["refresh"]}).status_code == 204
    assert api_client.get(url).status_code == 404
