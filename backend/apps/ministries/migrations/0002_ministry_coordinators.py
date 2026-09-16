from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ministries', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='ministry',
            name='coordinators',
            field=models.ManyToManyField(blank=True, limit_choices_to={'role': 'coordinator'}, related_name='coordinated_ministries', to=settings.AUTH_USER_MODEL),
        ),
    ]
