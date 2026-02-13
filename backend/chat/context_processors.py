
"""Содержит логику модуля `context_processors` подсистемы `chat`."""

from .constants import PUBLIC_ROOM_NAME, PUBLIC_ROOM_SLUG
from .models import Room


def public_rooms(request):
    """Выполняет логику `public_rooms` с параметрами из сигнатуры."""
    # Обеспечиваем наличие общей публичной комнаты, чтобы она всегда была видна в сайдбаре.
    Room.objects.get_or_create(slug=PUBLIC_ROOM_SLUG, defaults={"name": PUBLIC_ROOM_NAME})
    rooms = Room.objects.all()
    return {'rooms': rooms}
