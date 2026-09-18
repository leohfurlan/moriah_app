from decimal import Decimal

from django.conf import settings
from django.db import migrations, models
import django.core.validators


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0001_initial"),
        ("events", "0001_initial"),
        ("members", "0001_initial"),
        ("finance", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="FinancialEntry",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("entry_type", models.CharField(choices=[("income", "Entrada"), ("expense", "Saída")], max_length=12)),
                ("category", models.CharField(choices=[("offering", "Oferta"), ("tithe", "Dízimo"), ("event", "Evento"), ("donation", "Doação"), ("utilities", "Contas e serviços"), ("card", "Cartão"), ("payroll", "Pessoal"), ("other", "Outros")], default="other", max_length=20)),
                ("source", models.CharField(choices=[("manual", "Lançamento manual"), ("offer_acceptance", "Aceite de oferta"), ("event_payment", "Inscrição de evento"), ("contribution", "Contribuição")], default="manual", max_length=24)),
                ("status", models.CharField(choices=[("scheduled", "Agendado"), ("paid", "Pago"), ("cancelled", "Cancelado")], default="scheduled", max_length=12)),
                ("description", models.CharField(max_length=255)),
                ("amount", models.DecimalField(decimal_places=2, max_digits=12, validators=[django.core.validators.MinValueValidator(Decimal("0.01"))])),
                ("due_date", models.DateField()),
                ("paid_at", models.DateTimeField(blank=True, null=True)),
                ("notes", models.TextField(blank=True)),
                ("church", models.ForeignKey(on_delete=models.deletion.CASCADE, related_name="financial_entries", to="accounts.church")),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=models.deletion.SET_NULL, related_name="created_financial_entries", to=settings.AUTH_USER_MODEL)),
                ("event", models.ForeignKey(blank=True, null=True, on_delete=models.deletion.SET_NULL, related_name="financial_entries", to="events.event")),
                ("member", models.ForeignKey(blank=True, null=True, on_delete=models.deletion.SET_NULL, related_name="financial_entries", to="members.member")),
            ],
            options={
                "verbose_name": "Lançamento financeiro",
                "verbose_name_plural": "Lançamentos financeiros",
                "ordering": ["due_date", "-created_at"],
            },
        ),
        migrations.AddIndex(model_name="financialentry", index=models.Index(fields=["church", "due_date"], name="finance_fin_church__2e75b3_idx")),
        migrations.AddIndex(model_name="financialentry", index=models.Index(fields=["church", "status"], name="finance_fin_church__5f851d_idx")),
    ]
