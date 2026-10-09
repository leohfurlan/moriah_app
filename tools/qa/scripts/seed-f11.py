"""Synthetic fixtures for the disposable F11 PostgreSQL; refuses other databases."""
from django.conf import settings
from apps.accounts.models import Church, User, WhatsAppIdentity
from apps.members.models import Member

assert settings.DATABASES["default"]["NAME"] == "moriah_f11"
assert settings.DATABASES["default"]["PORT"] in ("18432", 18432)
assert settings.ONBOARDING_REQUIRED
church, _ = Church.objects.get_or_create(name="Moriah F11 QA")
for index, surface in enumerate(("desktop", "mobile")):
    for role_index, role in enumerate(("admin", "visitor")):
        email = f"f11-{role}-{surface}@example.invalid"
        user, created = User.objects.get_or_create(email=email, defaults={"username": email, "church": church,
            "first_name": "Pessoa", "last_name": f"{role} {surface}", "role": "admin" if role == "admin" else "member",
            "is_staff": role == "admin", "is_superuser": role == "admin"})
        if created:
            user.set_password("F11-local-only-2026")
            user.save()
            WhatsAppIdentity.objects.create(user=user, church=church, phone=f"+551199991{index}{role_index}01")
            if role == "visitor":
                Member.objects.create(church=church, user=user, full_name=f"Pessoa {surface}", status="visitor")
print("Synthetic F11 users ready; no production data used.")
