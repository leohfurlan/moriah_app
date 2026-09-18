from django.utils import timezone

from .models import Contribution, FinancialEntry


CONTRIBUTION_CATEGORY_TO_ENTRY_CATEGORY = {
    Contribution.Category.TITHE: FinancialEntry.Category.TITHE,
    Contribution.Category.OFFERING: FinancialEntry.Category.OFFERING,
    Contribution.Category.CAMPAIGN: FinancialEntry.Category.CAMPAIGN,
    Contribution.Category.MISSIONS: FinancialEntry.Category.MISSIONS,
    Contribution.Category.EVENT: FinancialEntry.Category.EVENT,
    Contribution.Category.OTHER: FinancialEntry.Category.OTHER,
}


def ensure_contribution_financial_entry(contribution: Contribution, created_by) -> FinancialEntry:
    """Registra uma contribuição aceita como entrada paga, de forma idempotente."""
    entry, _created = FinancialEntry.objects.get_or_create(
        contribution=contribution,
        defaults={
            "church": contribution.church,
            "entry_type": FinancialEntry.EntryType.INCOME,
            "category": CONTRIBUTION_CATEGORY_TO_ENTRY_CATEGORY[contribution.category],
            "source": FinancialEntry.Source.CONTRIBUTION,
            "status": FinancialEntry.Status.PAID,
            "description": f"{contribution.get_category_display()} - {contribution.member.full_name}",
            "amount": contribution.amount,
            "due_date": contribution.contribution_date,
            "paid_at": timezone.now(),
            "notes": contribution.notes,
            "member": contribution.member,
            "created_by": created_by,
        },
    )
    return entry
