import pytest
from apps.accounts.models import User

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize("role", [User.Role.TREASURER, User.Role.COORDINATOR])
def test_directory_limits_personal_fields(api_client, make_user, make_member, role):
    user = make_user("limited@example.invalid", role=role)
    member = make_member("Pessoa", notes="Pastoral private", address="Private address")
    api_client.force_authenticate(user)
    for path in ("/api/members/", f"/api/members/{member.pk}/"):
        response = api_client.get(path)
        data = response.json()[0] if isinstance(response.json(), list) else response.json()
        assert response.status_code == 200
        assert data["full_name"] == "Pessoa"
        assert not {"notes", "address", "birth_date", "family", "family_relationships", "marital_status"}.intersection(data)
