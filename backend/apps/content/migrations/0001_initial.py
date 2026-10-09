from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("accounts", "0001_initial")]

    operations = [
        migrations.CreateModel(
            name="Content",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("title", models.CharField(max_length=255)),
                ("summary", models.CharField(blank=True, max_length=500)),
                ("body", models.TextField()),
                ("status", models.CharField(choices=[("draft", "Rascunho"), ("published", "Publicado")], default="draft", max_length=12)),
                ("published_at", models.DateTimeField(blank=True, null=True)),
                ("author", models.ForeignKey(null=True, on_delete=models.deletion.SET_NULL, related_name="authored_contents", to=settings.AUTH_USER_MODEL)),
                ("church", models.ForeignKey(on_delete=models.deletion.CASCADE, related_name="contents", to="accounts.church")),
            ],
            options={"verbose_name": "Conteúdo", "verbose_name_plural": "Conteúdos", "ordering": ["-published_at", "-created_at"]},
        ),
        migrations.AddIndex(model_name="content", index=models.Index(fields=["church", "status"], name="content_con_church__5b8005_idx")),
    ]
