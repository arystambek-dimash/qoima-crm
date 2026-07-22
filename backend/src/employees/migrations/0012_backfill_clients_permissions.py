from django.db import migrations


def grant_clients_permissions_to_admins(apps, schema_editor):
    """Admin-equivalent employees (employees_can_create) managed clients
    before dedicated flags existed — keep their access."""
    Employee = apps.get_model("employees", "Employee")
    Employee.objects.filter(employees_can_create=True).update(
        clients_can_retrieve=True,
        clients_can_create=True,
        clients_can_update=True,
        clients_can_delete=True,
    )


class Migration(migrations.Migration):
    dependencies = [
        ("employees", "0011_employee_clients_can_create_and_more"),
    ]

    operations = [
        migrations.RunPython(
            grant_clients_permissions_to_admins,
            migrations.RunPython.noop,
        ),
    ]
