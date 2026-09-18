import pytest
from django.db import IntegrityError
from unittest.mock import patch
from apps.accounts.models import Church, User
from apps.accounts.permissions import user_capabilities
from apps.audit.models import AuditLog
from apps.content.models import Content
from rest_framework_simplejwt.tokens import AccessToken

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize("role", [User.Role.ADMIN, User.Role.PASTOR])
def test_publication_lifecycle_is_explicit_and_audited(api_client, make_user, church, role):
    publisher = make_user("publisher@example.com", role=role)
    api_client.force_authenticate(publisher)
    response = api_client.post("/api/content/", {"title": "Palavra", "body": "Mensagem", "status": "published", "church": 999}, format="json")
    assert response.status_code == 201
    obj = Content.objects.get()
    assert obj.church == church and obj.author == publisher and obj.status == "draft"
    assert "manage_content" in user_capabilities(publisher)
    assert api_client.patch(f"/api/content/{obj.pk}/", {"title": "Palavra editada"}, format="json").status_code == 200
    first = api_client.post(f"/api/content/{obj.pk}/publish/")
    repeat = api_client.post(f"/api/content/{obj.pk}/publish/")
    assert first.status_code == repeat.status_code == 200
    assert first.data["published_at"] == repeat.data["published_at"]
    assert api_client.patch(f"/api/content/{obj.pk}/", {"body": "Nova"}, format="json").status_code == 409
    assert api_client.post(f"/api/content/{obj.pk}/unpublish/").status_code == 200
    assert api_client.post(f"/api/content/{obj.pk}/unpublish/").status_code == 200
    assert list(AuditLog.objects.filter(model_name="Content").order_by("id").values_list("action", flat=True)) == [
        "content_created", "content_updated", "content_published", "content_unpublished"]


def test_member_sees_only_published_content_of_own_church(api_client, make_user, make_member, church):
    user = make_user("reader@example.com")
    make_member("Leitor", user=user)
    draft = Content.objects.create(church=church, title="Segredo", body="Rascunho")
    published = Content.objects.create(church=church, title="Público", body="Texto", status="published")
    other = Church.objects.create(name="Outra igreja")
    foreign = Content.objects.create(church=other, title="Outra", body="Texto", status="published")
    api_client.force_authenticate(user)
    response = api_client.get("/api/content/?page=1&page_size=1")
    assert response.status_code == 200 and response.data["count"] == 1
    assert response.data["results"][0]["id"] == published.pk
    assert api_client.get(f"/api/content/{published.pk}/").status_code == 200
    for obj in (draft, foreign):
        assert api_client.get(f"/api/content/{obj.pk}/").status_code == 404
    assert api_client.post("/api/content/", {"title": "Não", "body": "Não"}, format="json").status_code == 403
    for suffix in ("publish/", "unpublish/"):
        assert api_client.post(f"/api/content/{published.pk}/{suffix}").status_code == 403
    assert api_client.patch(f"/api/content/{published.pk}/", {"body": "Não"}, format="json").status_code == 403


@pytest.mark.parametrize("prefix", ["api", "backend", "local-api"])
def test_publisher_cannot_read_or_mutate_other_church(api_client, make_user, prefix):
    api_client.force_authenticate(make_user("admin@example.com", role="admin"))
    foreign = Content.objects.create(church=Church.objects.create(name="Outra"), title="Outro", body="Texto")
    path = f"/{prefix}/content/{foreign.pk}/"
    assert api_client.get(path).status_code == 404
    assert api_client.patch(path, {"title": "Invadido"}, format="json").status_code == 404
    assert api_client.post(path + "publish/").status_code == 404
    assert api_client.post(path + "unpublish/").status_code == 404
    foreign.refresh_from_db()
    assert foreign.title == "Outro" and foreign.status == "draft"


@pytest.mark.parametrize("role", ["member", "secretary", "treasurer", "coordinator", "cell_leader"])
def test_unlinked_non_publisher_is_denied(api_client, make_user, role):
    user = make_user("unlinked@example.com", role=role)
    api_client.force_authenticate(user)
    assert api_client.get("/api/content/").status_code == 403
    assert "read_content" not in user_capabilities(user)


def test_anonymous_and_no_church_are_denied(api_client, make_user):
    assert api_client.get("/api/content/").status_code == 401
    user = make_user("nochurch@example.com", role="admin")
    user.church = None
    user.save()
    api_client.force_authenticate(user)
    assert api_client.get("/api/content/").status_code == 403


@pytest.mark.parametrize("payload", [{"title": " ", "body": "Texto"}, {"title": "Título", "body": " "}, {"title": "x" * 256, "body": "Texto"}, {"title": "Título", "body": "x" * 50001}])
def test_invalid_content_does_not_persist(api_client, make_user, payload):
    api_client.force_authenticate(make_user("admin@example.com", role="admin"))
    assert api_client.post("/api/content/", payload, format="json").status_code == 400
    assert not Content.objects.exists()


def test_audit_failure_rolls_back_publication(api_client, make_user, church):
    api_client.force_authenticate(make_user("admin@example.com", role="admin"))
    obj = Content.objects.create(church=church, title="Teste", body="Texto")
    with patch("apps.content.views.AuditLog.objects.create", side_effect=IntegrityError("audit unavailable")):
        with pytest.raises(IntegrityError):
            api_client.post(f"/api/content/{obj.pk}/publish/")
    obj.refresh_from_db()
    assert obj.status == "draft" and obj.published_at is None


def test_real_jwt_reader_can_access_but_cannot_publish(api_client, make_user, make_member, church):
    user = make_user("jwt@example.com")
    make_member("JWT reader", user=user)
    obj = Content.objects.create(church=church, title="JWT", body="Texto", status="published")
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {AccessToken.for_user(user)}")
    assert api_client.get(f"/api/content/{obj.pk}/").status_code == 200
    assert api_client.post(f"/api/content/{obj.pk}/unpublish/").status_code == 403


@pytest.mark.django_db(transaction=True)
def test_concurrent_publication_is_idempotent_on_postgres(make_user, church):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier
    from django.db import connection, close_old_connections
    from rest_framework.test import APIClient

    if connection.vendor != "postgresql":
        pytest.skip("Row-lock concurrency requires PostgreSQL")
    user = make_user("concurrent@example.com", role="admin")
    obj = Content.objects.create(church=church, title="Concorrência", body="Texto")
    barrier = Barrier(2)

    def publish():
        close_old_connections()
        try:
            client = APIClient()
            client.credentials(HTTP_AUTHORIZATION=f"Bearer {AccessToken.for_user(user)}")
            barrier.wait(timeout=10)
            response = client.post(f"/api/content/{obj.pk}/publish/")
            return response.status_code, response.data["published_at"]
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(lambda _: publish(), range(2)))
    assert [result[0] for result in results] == [200, 200]
    assert results[0][1] == results[1][1]
    assert AuditLog.objects.filter(action="content_published", object_id=str(obj.pk)).count() == 1
