from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("employees", "0007_employee_wallets_can_create_and_more"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="employee",
            name="employees_can_see_salary",
        ),
    ]
