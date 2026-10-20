from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
import pytest
from django.db import connection, close_old_connections
from rest_framework.test import APIClient
from conftest import DEFAULT_PASSWORD
from .test_security_sessions import login

pytestmark = pytest.mark.django_db(transaction=True)


def race(requests):
    barrier = Barrier(len(requests))
    def run(request):
        close_old_connections()
        try:
            barrier.wait(timeout=10)
            return request(APIClient()).status_code
        finally:
            close_old_connections()
    with ThreadPoolExecutor(max_workers=len(requests)) as pool:
        return list(pool.map(run, requests))


def test_refresh_consumed_once_under_concurrency(make_user):
    if connection.vendor != "postgresql":
        pytest.skip("Row locks require PostgreSQL")
    user = make_user("refresh-race@example.invalid")
    tokens = login(APIClient(), user).json()
    request = lambda client: client.post("/api/auth/refresh/", {"refresh": tokens["refresh"]}, format="json")
    assert sorted(race([request, request])) == [200, 401]


def test_login_budget_shared_under_concurrency(make_user):
    if connection.vendor != "postgresql":
        pytest.skip("Row locks require PostgreSQL")
    user = make_user("limit-race@example.invalid")
    def request(client):
        return client.post("/backend/auth/login/", {"email": user.email, "password": "invalid"})
    results = race([request] * 8)
    assert results.count(401) == 5 and results.count(429) == 3
