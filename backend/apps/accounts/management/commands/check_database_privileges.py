from django.core.management.base import BaseCommand, CommandError
from django.db import connection


class Command(BaseCommand):
    help = "Read-only verification: application role must not be a cluster administrator."

    def handle(self, **options):
        if connection.vendor != "postgresql":
            raise CommandError("PostgreSQL is required for role verification.")
        with connection.cursor() as cursor:
            cursor.execute("SELECT rolsuper, rolcreaterole, rolcreatedb, rolreplication, rolbypassrls FROM pg_roles WHERE rolname = current_user")
            flags = cursor.fetchone()
            cursor.execute("SELECT pg_has_role(current_user, oid, 'MEMBER') FROM pg_roles WHERE rolsuper OR rolcreaterole OR rolcreatedb OR rolreplication OR rolbypassrls")
            inherited = any(row[0] for row in cursor.fetchall())
        if any(flags) or inherited:
            raise CommandError("Application database role has elevated cluster privileges.")
        self.stdout.write("Application database role has no elevated cluster privileges.")
