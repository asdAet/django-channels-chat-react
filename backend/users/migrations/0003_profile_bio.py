
"""Содержит миграцию `0003_profile_bio` приложения `users`."""


from django.db import migrations, models


class Migration(migrations.Migration):
    """Описывает операции миграции схемы данных."""

    dependencies = [
        ("users", "0002_profile_last_seen"),
    ]

    operations = [
        migrations.AddField(
            model_name="profile",
            name="bio",
            field=models.TextField(blank=True, max_length=1000),
        ),
    ]
