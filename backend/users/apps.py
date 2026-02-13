
"""Содержит логику модуля `apps` подсистемы `users`."""


from django.apps import AppConfig


class UsersConfig(AppConfig):
    """Инкапсулирует логику класса `UsersConfig`."""
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'users'

    def ready(self):
        """Выполняет логику `ready` с параметрами из сигнатуры."""
        import users.signals
