"""Local browser QA actions; never accepts a production database."""
from django.conf import settings
from django.utils import timezone
from apps.accounts.models import Church, ChurchSetup, OnboardingProfile
from apps.members.models import MemberLinkRequest
from apps.cells.models import Cell
from apps.events.models import Event, ServiceTime
from apps.ministries.models import Ministry

assert settings.DATABASES["default"]["NAME"] == "moriah_f11"
assert str(settings.DATABASES["default"]["PORT"]) == "18432"
church = Church.objects.get(name="Moriah F11 QA")
action = globals().get("qa_action", "fill")
if action == "reset":
    OnboardingProfile.objects.filter(user__church=church).delete()
    MemberLinkRequest.objects.filter(church=church).delete()
    Cell.objects.filter(church=church).delete()
    Event.objects.filter(church=church).delete()
    Ministry.objects.filter(church=church).delete()
    ServiceTime.objects.filter(church=church).delete()
    ChurchSetup.objects.filter(church=church).delete()
elif action == "fill":
    Cell.objects.get_or_create(church=church, name="Célula QA")
    Ministry.objects.get_or_create(church=church, name="Ministério QA")
    Event.objects.get_or_create(church=church, name="Evento QA", defaults={"start_at": timezone.now()})
elif action == "remove-cell":
    Cell.objects.filter(church=church).delete()
else:
    raise ValueError("Unknown fixture action")
print("Local synthetic fixture action completed.")
