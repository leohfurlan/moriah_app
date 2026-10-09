import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("finance", "0002_financialentry"),
    ]

    operations = [
        migrations.AddField(
            model_name="financialentry",
            name="contribution",
            field=models.OneToOneField(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="financial_entry",
                to="finance.contribution",
            ),
        ),
        migrations.AlterField(
            model_name="financialentry",
            name="category",
            field=models.CharField(
                choices=[
                    ("offering", "Oferta"),
                    ("tithe", "Dízimo"),
                    ("campaign", "Campanha"),
                    ("missions", "Missões"),
                    ("event", "Evento"),
                    ("donation", "Doação"),
                    ("utilities", "Contas e serviços"),
                    ("card", "Cartão"),
                    ("payroll", "Pessoal"),
                    ("other", "Outros"),
                ],
                default="other",
                max_length=20,
            ),
        ),
    ]
