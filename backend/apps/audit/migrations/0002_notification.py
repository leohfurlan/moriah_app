from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [("audit", "0001_initial")]
    operations = [
        migrations.CreateModel(
            name="Notification",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("category", models.CharField(max_length=40)),
                ("title", models.CharField(max_length=255)),
                ("body", models.TextField()),
                ("detail", models.TextField(blank=True)),
                ("action_label", models.CharField(blank=True, max_length=120)),
                ("action_route", models.CharField(blank=True, max_length=255)),
                ("dedupe_key", models.CharField(max_length=160, unique=True)),
                ("read_at", models.DateTimeField(blank=True, null=True)),
                ("church", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="notifications", to="accounts.church")),
                ("recipient", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="notifications", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.AddIndex(
            model_name="notification",
            index=models.Index(fields=["recipient", "read_at", "-created_at"], name="audit_notif_recipie_8d5dc3_idx"),
        ),
        migrations.AddIndex(
            model_name="notification",
            index=models.Index(fields=["church", "-created_at"], name="audit_notif_church_4ee1de_idx"),
        ),
    ]
