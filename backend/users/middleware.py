from datetime import timedelta

from django.db import OperationalError, ProgrammingError
from django.utils import timezone


class UpdateLastSeenMiddleware:
    """
    Обновляет поле last_seen у авторизованных пользователей.
    Чтобы избежать лишних запросов, обновляем не чаще чем раз в 30 секунд.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        user = getattr(request, "user", None)
        if user and user.is_authenticated:
            try:
                now = timezone.now()
                profile = getattr(user, "profile", None)
                if profile:
                    last_seen = profile.last_seen
                    if not last_seen or now - last_seen > timedelta(seconds=10):
                        profile.last_seen = now
                        profile.save(update_fields=["last_seen"])
            except (OperationalError, ProgrammingError):
                # База без миграции last_seen — просто пропускаем обновление.
                pass
        return self.get_response(request)
