from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("employees", "0009_employee_wallets_can_view_balance_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="employee",
            name="sales_can_retrieve",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="employee",
            name="sales_can_create",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="employee",
            name="sales_can_update",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="employee",
            name="sales_can_delete",
            field=models.BooleanField(default=False),
        ),
    ]
