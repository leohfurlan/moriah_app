from datetime import datetime, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.accounts.models import Church
from apps.accounts.roles import sync_role_permissions
from apps.cells.models import Cell
from apps.events.models import Event
from apps.finance.models import Contribution
from apps.members.models import Family, Member
from apps.ministries.models import Ministry, MinistryRole
from apps.schedules.models import Schedule, ScheduleAssignment, ScheduleItem, Song, WorshipTeam, WorshipTeamMember


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
        # A conta administrativa de desenvolvimento tambem exercita a
        # experiencia de membro. O papel principal fica como membro e
        # administracao e persistida como papel adicional.
        admin_user.church = church
        admin_user.role = user_model.Role.MEMBER
        admin_user.is_staff = True
        admin_user.is_superuser = True
        admin_user.set_password("admin123")
        admin_user.save()
        admin_user.add_role(user_model.Role.ADMIN)

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

        admin_member = Member.objects.filter(church=church, user=admin_user).first()
        if admin_member is None:
            admin_member = Member.objects.filter(church=church, email=admin_user.email).first()
        if admin_member is None:
            admin_member = Member.objects.filter(
                church=church,
                full_name__iexact=admin_user.get_full_name(),
            ).first()
        if admin_member is None:
            admin_member = Member.objects.create(
                church=church,
                user=admin_user,
                full_name=admin_user.get_full_name() or "Admin Moriah",
                email=admin_user.email,
                status=Member.Status.ACTIVE,
            )
        elif admin_member.user_id in (None, admin_user.id):
            if admin_member.user_id != admin_user.id:
                admin_member.user = admin_user
                admin_member.save(update_fields=["user", "updated_at"])

        ministry, _ = Ministry.objects.get_or_create(church=church, name="Louvor")
        ministry.members.add(member)
        worship_team, _ = WorshipTeam.objects.get_or_create(church=church, name="Equipe Principal")
        WorshipTeamMember.objects.get_or_create(church=church, team=worship_team, member=member, role="Vocal")
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
        if event.start_at < timezone.now() - timedelta(hours=1):
            event.start_at = timezone.now() + timedelta(days=3)
            event.active = True
            event.save(update_fields=["start_at", "active", "updated_at"])

        church_event_specs = [
            ("Escola Bíblica", "culto", 4, "Sala de ensino"),
            ("Encontro de jovens", "especial", 7, "Auditório"),
        ]
        for event_name, event_type, days_ahead, location in church_event_specs:
            Event.objects.get_or_create(
                church=church,
                name=event_name,
                defaults={
                    "event_type": event_type,
                    "start_at": timezone.now() + timedelta(days=days_ahead),
                    "location": location,
                },
            )

        schedule, _ = Schedule.objects.get_or_create(church=church, event=event, name="Escala Principal", defaults={"created_by": admin_user})
        ScheduleAssignment.objects.get_or_create(church=church, schedule=schedule, member=member, ministry_role=role)
        if schedule.worship_team_id != worship_team.id:
            schedule.worship_team = worship_team
            schedule.save(update_fields=["worship_team", "updated_at"])

        Contribution.objects.get_or_create(
            church=church,
            member=member,
            amount=Decimal("120.00"),
            contribution_date=datetime.today().date(),
            category=Contribution.Category.TITHE,
            defaults={"status": Contribution.Status.APPROVED, "created_by": member_user, "reviewed_by": treasurer},
        )

        # Equipe de louvor: sem mais gente escalada, a tela de detalhe da
        # escala nao tem nada para mostrar.
        equipe = [
            ("Joao Pedro", "joao.pedro@moriah.app", "Guitarra", ScheduleAssignment.Status.CONFIRMED),
            ("Ana Costa", "ana.costa@moriah.app", "Teclado", ScheduleAssignment.Status.PENDING),
            ("Lucas Dias", "lucas.dias@moriah.app", "Bateria", ScheduleAssignment.Status.DECLINED),
        ]
        for nome, email, funcao, situacao in equipe:
            colega, _ = user_model.objects.get_or_create(
                email=email,
                defaults={
                    "username": email.split("@")[0],
                    "first_name": nome.split()[0],
                    "last_name": nome.split()[-1],
                    "church": church,
                    "role": user_model.Role.MEMBER,
                },
            )
            colega.set_password("membro123")
            colega.save()
            colega_membro, _ = Member.objects.get_or_create(
                church=church,
                user=colega,
                defaults={"full_name": nome, "email": email, "status": Member.Status.ACTIVE},
            )
            funcao_obj, _ = MinistryRole.objects.get_or_create(
                church=church, ministry=ministry, name=funcao
            )
            ScheduleAssignment.objects.get_or_create(
                church=church,
                schedule=schedule,
                member=colega_membro,
                ministry_role=funcao_obj,
                defaults={"status": situacao},
            )

        # Repertorio / ordem do culto.
        repertorio = [
            (1, ScheduleItem.ItemType.SONG, "Grande e o Senhor", "G", "https://www.cifraclub.com.br/"),
            (2, ScheduleItem.ItemType.SONG, "Teu Amor Nao Falha", "D", ""),
            (3, ScheduleItem.ItemType.MOMENT, "Ministracao da Palavra", "", ""),
            (4, ScheduleItem.ItemType.SONG, "Nada Alem do Sangue", "Em", ""),
        ]
        for ordem, tipo, titulo, tom, link in repertorio:
            item, _ = ScheduleItem.objects.get_or_create(
                church=church,
                schedule=schedule,
                order=ordem,
                defaults={"item_type": tipo, "title": titulo, "song_key": tom, "reference_url": link},
            )
            if tipo == ScheduleItem.ItemType.SONG:
                song, _ = Song.objects.get_or_create(
                    church=church,
                    title=titulo,
                    artist="Moriah",
                    defaults={"default_key": tom, "chord_url": link},
                )
                if item.song_id != song.id:
                    item.song = song
                    item.save(update_fields=["song", "updated_at"])

        if not schedule.notes:
            schedule.notes = "Chegar as 18h para passagem de som. Traga seu proprio cabo."
            schedule.save(update_fields=["notes", "updated_at"])

        # Sem isso tesouraria e secretaria entram no admin e nao veem nada:
        # ``is_staff`` sozinho nao concede permissao sobre nenhum modelo.
        groups, users = sync_role_permissions()
        self.stdout.write(f"Permissoes de papel sincronizadas: {groups} grupos, {users} usuarios.")

        self.stdout.write(self.style.SUCCESS("Seed do MVP criado com sucesso."))
