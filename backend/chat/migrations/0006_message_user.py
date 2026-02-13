
"""Содержит миграцию `0006_message_user` приложения `chat`."""


from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def _get_user_model(apps):
    """Выполняет логику `_get_user_model` с параметрами из сигнатуры."""
    app_label, model_name = settings.AUTH_USER_MODEL.split(".")
    return apps.get_model(app_label, model_name)


def forwards(apps, schema_editor):
    """Выполняет логику `forwards` с параметрами из сигнатуры."""
    Message = apps.get_model("chat", "Message")
    User = _get_user_model(apps)
    username_to_id = {user.username: user.id for user in User.objects.all()}
    for message in Message.objects.filter(user__isnull=True):
        user_id = username_to_id.get(message.username)
        if user_id:
            message.user_id = user_id
            message.save(update_fields=["user"])


def backwards(apps, schema_editor):
    """Выполняет логику `backwards` с параметрами из сигнатуры."""
    Message = apps.get_model("chat", "Message")
    Message.objects.update(user=None)


class Migration(migrations.Migration):
    """Описывает операции миграции схемы данных."""

    dependencies = [
        ("chat", "0005_alter_message_date_added"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="message",
            name="user",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="messages",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.RunPython(forwards, backwards),
    ]
