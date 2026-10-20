from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from apps.accounts.models import User, MFAFactor, MFAChallenge, AuthSession
from apps.audit.models import AuditLog


class Command(BaseCommand):
    help = "Reset manual auditado após conferir identidade fora do aplicativo. Revoga todas as sessões."

    def add_arguments(self, parser):
        parser.add_argument("--user-id", type=int, required=True)
        parser.add_argument("--confirm-email", required=True)
        parser.add_argument("--reason", required=True)

    @transaction.atomic
    def handle(self, **options):
        user = User.objects.select_for_update().filter(pk=options["user_id"]).first()
        if not user or not user.church_id or user.email != options["confirm_email"] or len(options["reason"].strip()) < 15:
            raise CommandError("Confirme usuário, e-mail e justificativa de pelo menos 15 caracteres.")
        AuthSession.objects.filter(user=user, revoked_at__isnull=True).update(revoked_at=timezone.now())
        MFAChallenge.objects.filter(user=user, consumed_at__isnull=True).update(consumed_at=timezone.now())
        MFAFactor.objects.filter(user=user).delete()
        AuditLog.objects.create(church=user.church, user=None, action="mfa_reset_by_operator",
                                model_name="User", object_id=str(user.pk), payload={"reason": options["reason"][:500]})
        self.stdout.write("Fator removido e sessões revogadas. O próximo login exigirá novo cadastro MFA.")
