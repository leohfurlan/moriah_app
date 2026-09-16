import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0001_initial'),
        ('members', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='MemberUpdateRequest',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('requested_changes', models.JSONField(default=dict)),
                ('status', models.CharField(choices=[('pending', 'Pendente'), ('approved', 'Aprovada'), ('rejected', 'Rejeitada')], default='pending', max_length=20)),
                ('review_notes', models.TextField(blank=True)),
                ('reviewed_at', models.DateTimeField(blank=True, null=True)),
                ('church', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='member_update_requests', to='accounts.church')),
                ('member', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='update_requests', to='members.member')),
                ('reviewed_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='reviewed_member_update_requests', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Solicitacao de alteracao cadastral',
                'verbose_name_plural': 'Solicitacoes de alteracao cadastral',
                'ordering': ['-created_at'],
            },
        ),
    ]
