from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='event',
            name='event_type',
            field=models.CharField(blank=True, choices=[('culto', 'Culto'), ('celula', 'Celula'), ('ensaio', 'Ensaio'), ('reuniao', 'Reuniao'), ('conferencia', 'Conferencia'), ('especial', 'Evento especial')], max_length=100),
        ),
    ]
