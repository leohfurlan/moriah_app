from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.accounts.models import WhatsAppChallenge, WhatsAppSendLimit


class Command(BaseCommand):
    help = "Remove expired OTP metadata after one day; never deletes verified identities."

    def handle(self, **options):
        now = timezone.now()
        WhatsAppChallenge.objects.filter(expires_at__lt=now-timedelta(days=1)).delete()
        WhatsAppSendLimit.objects.filter(window_started__lt=now-timedelta(days=2)).delete()
        self.stdout.write("Expired WhatsApp authentication metadata removed")
