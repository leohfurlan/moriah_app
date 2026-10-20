"""Report counts only; never change financial records."""
import json
from django.core.management.base import BaseCommand, CommandError
from django.db.models import F
from apps.finance.models import FinancialEntry


class Command(BaseCommand):
    help = 'Verifica referências financeiras entre igrejas, somente leitura.'

    def handle(self, **options):
        counts = {field: FinancialEntry.objects.filter(**{field + '__isnull': False}).exclude(
            **{field + '__church_id': F('church_id')}).count()
            for field in ('member', 'event', 'contribution', 'created_by')}
        self.stdout.write(json.dumps(counts))
        if any(counts.values()):
            raise CommandError('Referências inconsistentes; nenhuma alteração aplicada.')
