import django.db.models.deletion
from django.conf import settings
import apps.events.models
from django.db import migrations, models
from django.db.models import Q


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0002_userroleassignment"),
        ("events", "0002_alter_event_event_type"),
    ]

    operations = [
        migrations.CreateModel(
            name="EventAnnouncement",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("title", models.CharField(blank=True, max_length=255)),
                ("image", models.FileField(upload_to=apps.events.models.event_announcement_path)),
                ("position", models.PositiveSmallIntegerField(default=1)),
                ("active", models.BooleanField(default=True)),
                ("church", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="event_announcements", to="accounts.church")),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="created_event_announcements", to=settings.AUTH_USER_MODEL)),
                ("event", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="announcements", to="events.event")),
            ],
            options={
                "verbose_name": "Aviso do carrossel",
                "verbose_name_plural": "Avisos do carrossel",
                "ordering": ["position", "created_at"],
            },
        ),
        migrations.AddConstraint(
            model_name="eventannouncement",
            constraint=models.CheckConstraint(condition=Q(("position__gte", 1), ("position__lte", 4)), name="event_announcement_position_1_4"),
        ),
        migrations.AddConstraint(
            model_name="eventannouncement",
            constraint=models.UniqueConstraint(condition=Q(("active", True)), fields=("church", "position"), name="active_event_announcement_position_unique"),
        ),
    ]
