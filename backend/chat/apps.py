"""Конфигурация Django-приложения chat."""

from django.apps import AppConfig


class ChatConfig(AppConfig):
    """Основной AppConfig для модуля chat."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "chat"

    def ready(self):
        """Подключает signal handlers приложения chat."""
        import chat.signals  # noqa: F401
