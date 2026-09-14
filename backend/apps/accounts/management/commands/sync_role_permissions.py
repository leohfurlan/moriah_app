from django.core.management.base import BaseCommand

from apps.accounts.roles import sync_role_permissions


class Command(BaseCommand):
    help = "Sincroniza os grupos do Django Admin e as permissoes de cada papel."

    def handle(self, *args, **options):
        groups, users = sync_role_permissions()
        self.stdout.write(
            self.style.SUCCESS(f"{groups} grupos sincronizados e {users} usuarios atualizados.")
        )
