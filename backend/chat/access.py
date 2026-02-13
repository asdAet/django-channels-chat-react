
"""Содержит логику модуля `access` подсистемы `chat`."""


from __future__ import annotations

from django.http import Http404

from .models import ChatRole, Room

READ_ROLES = {
    ChatRole.Role.OWNER,
    ChatRole.Role.ADMIN,
    ChatRole.Role.MEMBER,
    ChatRole.Role.VIEWER,
}
WRITE_ROLES = {
    ChatRole.Role.OWNER,
    ChatRole.Role.ADMIN,
    ChatRole.Role.MEMBER,
}


def _direct_contains_user(room: Room, user) -> bool:
    """Выполняет логику `_direct_contains_user` с параметрами из сигнатуры."""
    if not room.direct_pair_key or not user or not user.is_authenticated:
        return False
    if ":" not in room.direct_pair_key:
        return False
    first, second = room.direct_pair_key.split(":", 1)
    try:
        return int(user.id) in {int(first), int(second)}
    except (TypeError, ValueError):
        return False


def get_user_role(room: Room, user) -> str | None:
    """Выполняет логику `get_user_role` с параметрами из сигнатуры."""
    if not user or not user.is_authenticated:
        return None
    return (
        ChatRole.objects.filter(room=room, user=user)
        .values_list("role", flat=True)
        .first()
    )


def can_read(room: Room, user) -> bool:
    """Выполняет логику `can_read` с параметрами из сигнатуры."""
    if room.kind == Room.Kind.PUBLIC:
        return True

    if not user or not user.is_authenticated:
        return False

    if room.kind == Room.Kind.DIRECT and not _direct_contains_user(room, user):
        return False

    role = get_user_role(room, user)
    return bool(role and role in READ_ROLES)


def can_write(room: Room, user) -> bool:
    """Выполняет логику `can_write` с параметрами из сигнатуры."""
    if room.kind == Room.Kind.PUBLIC:
        return bool(user and user.is_authenticated)

    if not user or not user.is_authenticated:
        return False

    if room.kind == Room.Kind.DIRECT and not _direct_contains_user(room, user):
        return False

    role = get_user_role(room, user)
    return bool(role and role in WRITE_ROLES)


def ensure_can_read_or_404(room: Room, user) -> None:
    """Выполняет логику `ensure_can_read_or_404` с параметрами из сигнатуры."""
    if not can_read(room, user):
        raise Http404("Not found")


def ensure_can_write(room: Room, user) -> bool:
    """Выполняет логику `ensure_can_write` с параметрами из сигнатуры."""
    return can_write(room, user)
