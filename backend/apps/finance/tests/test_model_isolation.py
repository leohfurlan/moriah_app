import pytest
from django.core.exceptions import ValidationError
from django.core.management import call_command
from apps.accounts.models import Church
from apps.finance.models import FinancialEntry
from apps.members.models import Member

pytestmark = pytest.mark.django_db


def test_model_rejects_foreign_reference(church):
    foreign = Member.objects.create(church=Church.objects.create(name="Other"), full_name="Other member")
    with pytest.raises(ValidationError):
        FinancialEntry.objects.create(church=church, member=foreign, entry_type="expense", amount=10, description="Invalid")
    assert not FinancialEntry.objects.exists()
    call_command("check_financial_isolation")
