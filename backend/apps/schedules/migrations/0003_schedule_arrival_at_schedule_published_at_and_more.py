import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0001_initial'),
        ('members', '0002_memberupdaterequest'),
        ('schedules', '0002_scheduleitem'),
    ]

    operations = [
        migrations.AddField(
            model_name='schedule',
            name='arrival_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='schedule',
            name='published_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='schedule',
            name='rehearsal_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='schedule',
            name='status',
            field=models.CharField(choices=[('draft', 'Rascunho'), ('published', 'Publicada'), ('cancelled', 'Cancelada')], default='published', max_length=20),
        ),
        migrations.AddField(
            model_name='scheduleassignment',
            name='conflict_reason',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='scheduleassignment',
            name='substitution_for',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='substitutions', to='schedules.scheduleassignment'),
        ),
        migrations.AddField(
            model_name='scheduleitem',
            name='bpm',
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='scheduleitem',
            name='duration_seconds',
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='scheduleassignment',
            name='status',
            field=models.CharField(choices=[('pending', 'Pendente'), ('confirmed', 'Confirmado'), ('declined', 'Recusado'), ('unavailable', 'Indisponivel'), ('conflict', 'Conflito de horario'), ('replacement_needed', 'Substituicao necessaria')], default='pending', max_length=20),
        ),
        migrations.CreateModel(
            name='Song',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('title', models.CharField(max_length=255)),
                ('artist', models.CharField(blank=True, max_length=255)),
                ('default_key', models.CharField(blank=True, max_length=12)),
                ('bpm', models.PositiveIntegerField(blank=True, null=True)),
                ('duration_seconds', models.PositiveIntegerField(blank=True, null=True)),
                ('tags', models.CharField(blank=True, max_length=255)),
                ('spotify_url', models.URLField(blank=True)),
                ('youtube_url', models.URLField(blank=True)),
                ('chord_url', models.URLField(blank=True)),
                ('notes', models.TextField(blank=True)),
                ('active', models.BooleanField(default=True)),
                ('church', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='songs', to='accounts.church')),
            ],
            options={
                'verbose_name': 'Musica do Repertorio',
                'verbose_name_plural': 'Musicas do Repertorio',
                'ordering': ['title'],
                'unique_together': {('church', 'title', 'artist')},
            },
        ),
        migrations.AddField(
            model_name='scheduleitem',
            name='song',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='schedule_items', to='schedules.song'),
        ),
        migrations.CreateModel(
            name='WorshipTeam',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('name', models.CharField(max_length=255)),
                ('description', models.TextField(blank=True)),
                ('active', models.BooleanField(default=True)),
                ('church', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='worship_teams', to='accounts.church')),
            ],
            options={
                'verbose_name': 'Equipe de Louvor',
                'verbose_name_plural': 'Equipes de Louvor',
            },
        ),
        migrations.AddField(
            model_name='schedule',
            name='worship_team',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='schedules', to='schedules.worshipteam'),
        ),
        migrations.CreateModel(
            name='WorshipTeamMember',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('role', models.CharField(max_length=120)),
                ('active', models.BooleanField(default=True)),
                ('church', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='worship_team_members', to='accounts.church')),
                ('member', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='worship_team_memberships', to='members.member')),
                ('team', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='team_members', to='schedules.worshipteam')),
            ],
            options={
                'verbose_name': 'Integrante da Equipe de Louvor',
                'verbose_name_plural': 'Integrantes das Equipes de Louvor',
                'unique_together': {('team', 'member', 'role')},
            },
        ),
        migrations.AddField(
            model_name='worshipteam',
            name='members',
            field=models.ManyToManyField(blank=True, related_name='worship_teams', through='schedules.WorshipTeamMember', to='members.member'),
        ),
        migrations.AlterUniqueTogether(
            name='worshipteam',
            unique_together={('church', 'name')},
        ),
    ]
