from django.core.management.base import BaseCommand
from django.db import transaction
from apps.members.models import MemberLinkRequest
from apps.members.linking import notify_reviewers


class Command(BaseCommand):
    help = "Recover missing in-app notifications for pending member links."

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true')
        parser.add_argument('--church-id', type=int, required=True)

    @transaction.atomic
    def handle(self, *args, **options):
        count = 0
        items = MemberLinkRequest.objects.filter(church_id=options['church_id'], status='pending')
        total = items.count()
        for item in items:
            count += notify_reviewers(item)
        if options['dry_run']:
            transaction.set_rollback(True)
        self.stdout.write(f"Pending requests: {total}; missing notifications: {count}; dry_run={options['dry_run']}")
