
"""Содержит миграцию `0002_profile_last_seen` приложения `users`."""


from django.db import migrations, models


class Migration(migrations.Migration):
    """Описывает операции миграции схемы данных."""

    dependencies = [
        ('users', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='profile',
            name='last_seen',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
