from datetime import date
import pytest
from django.contrib import admin
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken
from apps.accounts.models import Church, OnboardingProfile, User, WhatsAppIdentity
from apps.audit.models import AuditLog
from apps.cells.models import Cell
from apps.events.models import Event
from apps.members.models import Member
from apps.ministries.models import Ministry

pytestmark = pytest.mark.django_db


def client(user):
    c = APIClient(); c.credentials(HTTP_AUTHORIZATION=f"Bearer {AccessToken.for_user(user)}")
    return c


@pytest.fixture
def manager(make_user, settings):
    settings.ONBOARDING_REQUIRED = True
    user = make_user("manager@example.invalid", role="admin")
    OnboardingProfile.objects.create(user=user, birth_date=date(1990,1,1), relationship="member", completed_at=timezone.now())
    return user


@pytest.mark.parametrize("path", ["details/", "registrations/options/", "registrations/team/", "registrations/events/", "registrations/cells/", "registrations/ministries/"])
def test_management_requires_admin_and_profile(manager, make_user, path):
    assert client(manager).get("/backend/church/" + path).status_code == 200
    member = make_user("member@example.invalid")
    OnboardingProfile.objects.create(user=member, completed_at=timezone.now())
    assert client(member).get("/backend/church/" + path).status_code == 403
    OnboardingProfile.objects.filter(user=manager).delete()
    assert client(manager).get("/backend/church/" + path).json()["code"] == "onboarding_required"


def test_church_edits_are_scoped_and_audited(manager):
    other = Church.objects.create(name="Outra")
    c = client(manager)
    assert c.patch("/backend/church/details/", {"name":"Nome revisto","state":"sp"},format="json").status_code == 200
    manager.church.refresh_from_db(); other.refresh_from_db()
    assert manager.church.name == "Nome revisto" and manager.church.state == "SP"
    assert other.name == "Outra"
    assert c.patch("/backend/church/details/", {"id":other.pk},format="json").status_code == 400
    assert AuditLog.objects.filter(user=manager,action="church_details_updated").exists()


@pytest.mark.parametrize("resource,model,body", [
    ("cells",Cell,{"name":"Célula nova","meeting_time":"19:30"}),
    ("ministries",Ministry,{"name":"Louvor","description":"Descrição"}),
    ("events",Event,{"name":"Culto","event_type":"culto","start_at":"2026-11-01T19:00:00-03:00","active":True}),
])
def test_create_edit_and_tenant_isolation(manager, resource, model, body):
    other = Church.objects.create(name="Outra")
    foreign = model.objects.create(church=other,name="Privado",**({"start_at":timezone.now()} if model is Event else {}))
    path = f"/backend/church/registrations/{resource}/"
    c = client(manager)
    result = c.post(path,body,format="json")
    assert result.status_code == 201,result.data
    pk = result.json()["id"]
    assert model.objects.get(pk=pk).church_id == manager.church_id
    assert c.patch(f"{path}{pk}/",{"name":"Revisado"},format="json").status_code == 200
    assert c.get(f"{path}{foreign.pk}/").status_code == 404
    assert c.patch(f"{path}{foreign.pk}/",{"name":"Ataque"},format="json").status_code == 404
    assert c.post(path,{**body,"church_id":other.pk},format="json").status_code == 400
    assert all(item["id"] != foreign.pk for item in c.get(path).json())
    assert AuditLog.objects.filter(user=manager,object_id=str(pk),action="registration_created").exists()


def test_related_people_cannot_cross_church(manager, make_user):
    other = Church.objects.create(name="Outra")
    foreign = make_user("foreign@example.invalid"); foreign.church=other; foreign.save()
    member = Member.objects.create(church=other,full_name="Privado")
    c=client(manager)
    for body in ({"leader":foreign.pk},{"assistant_leader":foreign.pk}):
        assert c.post("/backend/church/registrations/cells/",{"name":"Teste",**body},format="json").status_code == 400
    for body in ({"coordinators":[foreign.pk]},{"members":[member.pk]}):
        assert c.post("/backend/church/registrations/ministries/",{"name":"Teste",**body},format="json").status_code == 400
    options=c.get("/backend/church/registrations/options/").json()
    assert not any(item["id"]==foreign.pk for item in options["users"])
    assert not any(item["id"]==member.pk for item in options["members"])


def test_team_creation_roles_and_protected_fields(manager, make_user):
    c=client(manager); path="/backend/church/registrations/team/"
    body={"name":"Pessoa Equipe","email":"Equipe@example.invalid","password":"Strong-2026-QA-only!","role":"secretary","additional_roles":["treasurer"]}
    result=c.post(path,body,format="json")
    assert result.status_code==201,result.data
    account=User.objects.get(pk=result.json()["id"])
    assert account.check_password(body["password"])
    assert account.email=="equipe@example.invalid" and account.church_id==manager.church_id
    assert account.assigned_roles()==frozenset(("secretary","treasurer"))
    assert not account.is_superuser and not account.is_staff
    assert "password" not in result.json() and body["password"] not in str(AuditLog.objects.values_list("payload",flat=True))
    assert c.patch(f"{path}{account.pk}/",{"role":"pastor","additional_roles":[],"is_active":False},format="json").status_code==200
    account.refresh_from_db(); assert account.assigned_roles()==frozenset(("pastor",)) and not account.is_active
    for field in ("is_superuser","is_staff","church_id","groups","user_permissions"):
        assert c.patch(f"{path}{account.pk}/",{field:True},format="json").status_code==400
    for email in (body["email"],"ADMIN@IGREJAMORIAH.COM"):
        assert c.post(path,{**body,"email":email},format="json").status_code==400
    assert c.post(path,{**body,"email":"weak@example.invalid","password":"123"},format="json").status_code==400
    assert c.patch(f"{path}{account.pk}/",{"email":"admin@igrejamoriah.com"},format="json").status_code==400
    assert c.patch(f"{path}{manager.pk}/",{"is_active":False},format="json").status_code==400
    owner=make_user("admin@igrejamoriah.com",role="admin",is_staff=True)
    assert c.patch(f"{path}{owner.pk}/",{"role":"member"},format="json").status_code==400


def test_event_end_and_time_validation(manager):
    body={"name":"Evento","start_at":"2026-11-01T19:00:00-03:00","end_at":"2026-11-01T18:00:00-03:00"}
    assert client(manager).post("/backend/church/registrations/events/",body,format="json").status_code==400
    assert client(manager).post("/backend/church/registrations/cells/",{"name":"Célula","meeting_time":"25:00"},format="json").status_code==400


def test_all_setup_links_are_app_routes(manager):
    items=client(manager).get("/backend/church/setup/").json()["items"]
    assert len(items)==6 and all(item["action_url"] and not item["action_url"].startswith("/admin") for item in items)


@pytest.mark.parametrize("role", ["admin","pastor","secretary","treasurer"])
def test_other_staff_and_superusers_cannot_use_admin(manager, make_user, settings, role):
    settings.ONBOARDING_REQUIRED=False
    user=make_user(role+"@example.invalid",role=role,is_staff=True,is_superuser=True)
    c=APIClient(); c.force_login(user)
    for path in ("/admin/","/admin/login/","/admin/accounts/user/","/admin/accounts/church/1/change/"):
        assert c.get(path).status_code==403
    from django.test import RequestFactory
    request=RequestFactory().get("/admin/"); request.user=user
    assert admin.site.has_permission(request) is False
    c.logout()
    result=c.post("/admin/login/",{"username":user.email,"password":"senha-forte-123","next":"/admin/"})
    assert result.status_code==200 and "_auth_user_id" not in c.session


def test_owner_positive_control(manager, make_user, settings):
    settings.ONBOARDING_REQUIRED=False
    owner=make_user("admin@igrejamoriah.com",role="admin",is_staff=True,is_superuser=True)
    c=APIClient()
    result=c.post("/admin/login/",{"username":owner.email,"password":"senha-forte-123","next":"/admin/"})
    assert result.status_code==302
    assert c.get("/admin/").status_code==200
