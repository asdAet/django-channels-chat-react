
"""Содержит логику модуля `apps` подсистемы `chat`."""


from django.apps import AppConfig


class ChatConfig(AppConfig):
    """Инкапсулирует логику класса `ChatConfig`."""
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'chat'
