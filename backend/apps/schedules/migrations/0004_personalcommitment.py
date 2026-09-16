import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0001_initial'),
        ('members', '0002_memberupdaterequest'),
        ('schedules', '0003_schedule_arrival_at_schedule_published_at_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='PersonalCommitment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('title', models.CharField(max_length=255)),
                ('commitment_type', models.CharField(choices=[('personal', 'Pessoal'), ('ministry', 'Ministerial'), ('cell', 'Celula'), ('meeting', 'Reuniao'), ('other', 'Outro')], default='personal', max_length=20)),
                ('starts_at', models.DateTimeField()),
                ('ends_at', models.DateTimeField(blank=True, null=True)),
                ('status', models.CharField(choices=[('planned', 'Planejado'), ('cancelled', 'Cancelado')], default='planned', max_length=20)),
                ('notes', models.TextField(blank=True)),
                ('church', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='personal_commitments', to='accounts.church')),
                ('member', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='personal_commitments', to='members.member')),
            ],
            options={
                'verbose_name': 'Compromisso pessoal',
                'verbose_name_plural': 'Compromissos pessoais',
                'ordering': ['starts_at'],
            },
        ),
    ]
