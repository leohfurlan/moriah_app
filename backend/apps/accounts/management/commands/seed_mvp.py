from datetime import datetime, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.accounts.models import Church
from apps.cells.models import Cell
from apps.events.models import Event
from apps.finance.models import Contribution
from apps.members.models import Family, Member
from apps.ministries.models import Ministry, MinistryRole
from apps.schedules.models import Schedule, ScheduleAssignment


class Command(BaseCommand):
    help = "Cria dados seed para o fluxo principal do MVP."

    def handle(self, *args, **options):
        user_model = get_user_model()
        church, _ = Church.objects.get_or_create(name="Igreja Moriah", defaults={"city": "Sorocaba", "state": "SP"})

        admin_user, _ = user_model.objects.get_or_create(
            email="admin@moriah.app",
            defaults={
                "username": "admin",
                "first_name": "Admin",
                "last_name": "Moriah",
                "church": church,
                "role": user_model.Role.ADMIN,
                "is_staff": True,
                "is_superuser": True,
            },
        )
        admin_user.set_password("admin123")
        admin_user.save()

        treasurer, _ = user_model.objects.get_or_create(
            email="tesouraria@moriah.app",
            defaults={
                "username": "tesouraria",
                "first_name": "Teso",
                "last_name": "Moriah",
                "church": church,
                "role": user_model.Role.TREASURER,
                "is_staff": True,
            },
        )
        treasurer.set_password("tesouraria123")
        treasurer.save()

        member_user, _ = user_model.objects.get_or_create(
            email="membro@moriah.app",
            defaults={
                "username": "membro",
                "first_name": "Maria",
                "last_name": "Silva",
                "church": church,
                "role": user_model.Role.MEMBER,
            },
        )
        member_user.set_password("membro123")
        member_user.save()

        leader_user, _ = user_model.objects.get_or_create(
            email="lider.celula@moriah.app",
            defaults={
                "username": "lidercelula",
                "first_name": "Joao",
                "last_name": "Lider",
                "church": church,
                "role": user_model.Role.CELL_LEADER,
            },
        )
        leader_user.set_password("lider123")
        leader_user.save()

        family, _ = Family.objects.get_or_create(church=church, name="Familia Silva")
        cell, _ = Cell.objects.get_or_create(church=church, name="Celula Centro", defaults={"leader": leader_user, "meeting_day": "Quarta", "location": "Casa da Ana"})

        member, _ = Member.objects.get_or_create(
            church=church,
            user=member_user,
            defaults={
                "family": family,
                "cell": cell,
                "full_name": "Maria Silva",
                "email": "membro@moriah.app",
                "phone": "(15) 99999-9999",
                "status": Member.Status.ACTIVE,
            },
        )

        ministry, _ = Ministry.objects.get_or_create(church=church, name="Louvor")
        ministry.members.add(member)
        role, _ = MinistryRole.objects.get_or_create(church=church, ministry=ministry, name="Vocal")

        event, _ = Event.objects.get_or_create(
            church=church,
            name="Culto de Domingo",
            defaults={
                "event_type": "culto",
                "start_at": timezone.now() + timedelta(days=3),
                "location": "Templo Sede",
            },
        )
        schedule, _ = Schedule.objects.get_or_create(church=church, event=event, name="Escala Principal", defaults={"created_by": admin_user})
        ScheduleAssignment.objects.get_or_create(church=church, schedule=schedule, member=member, ministry_role=role)

        Contribution.objects.get_or_create(
            church=church,
            member=member,
            amount=Decimal("120.00"),
            contribution_date=datetime.today().date(),
            category=Contribution.Category.TITHE,
            defaults={"status": Contribution.Status.APPROVED, "created_by": member_user, "reviewed_by": treasurer},
        )

        self.stdout.write(self.style.SUCCESS("Seed do MVP criado com sucesso."))
