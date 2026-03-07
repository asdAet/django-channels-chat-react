"""Pinned message management for groups."""

from __future__ import annotations

from django.conf import settings

from chat_app_django.security.audit import audit_security_event
from groups.application.group_service import (
    GroupError,
    GroupForbiddenError,
    GroupNotFoundError,
    _ensure_authenticated,
    _load_group_or_raise,
)
from groups.infrastructure.models import PinnedMessage
from messages.models import Message
from roles.application.permission_service import compute_permissions
from roles.permissions import Perm
from rooms.models import Room


def pin_message(actor, room_slug: str, message_id: int) -> PinnedMessage:
    """Pin a message in a group. Requires PIN_MESSAGES or MANAGE_MESSAGES."""
    _ensure_authenticated(actor)
    room = _load_group_or_raise(room_slug)

    effective = compute_permissions(room, actor)
    if not (effective & (Perm.PIN_MESSAGES | Perm.MANAGE_MESSAGES | Perm.ADMINISTRATOR)):
        raise GroupForbiddenError("Missing permission to pin messages")

    message = Message.objects.filter(pk=int(message_id), room=room).first()
    if not message:
        raise GroupNotFoundError("Message not found in this group")

    max_pins = getattr(settings, "GROUP_MAX_PINNED_MESSAGES", 100)
    pin_count = PinnedMessage.objects.filter(room=room).count()
    if pin_count >= max_pins:
        raise GroupError(f"Maximum of {max_pins} pinned messages per group")

    pin, created = PinnedMessage.objects.get_or_create(
        room=room,
        message=message,
        defaults={"pinned_by": actor},
    )

    if created:
        audit_security_event(
            "group.message.pinned",
            actor_user=actor,
            actor_user_id=getattr(actor, "pk", None),
            actor_username=getattr(actor, "username", None),
            is_authenticated=True,
            room_slug=room.slug,
            message_id=message_id,
        )
    return pin


def unpin_message(actor, room_slug: str, message_id: int) -> None:
    """Unpin a message from a group."""
    _ensure_authenticated(actor)
    room = _load_group_or_raise(room_slug)

    effective = compute_permissions(room, actor)
    if not (effective & (Perm.PIN_MESSAGES | Perm.MANAGE_MESSAGES | Perm.ADMINISTRATOR)):
        raise GroupForbiddenError("Missing permission to unpin messages")

    pin = PinnedMessage.objects.filter(
        room=room, message_id=int(message_id)
    ).first()
    if not pin:
        raise GroupNotFoundError("Pinned message not found")

    pin.delete()

    audit_security_event(
        "group.message.unpinned",
        actor_user=actor,
        actor_user_id=getattr(actor, "pk", None),
        actor_username=getattr(actor, "username", None),
        is_authenticated=True,
        room_slug=room.slug,
        message_id=message_id,
    )


def list_pinned(room_slug: str, actor) -> list[dict]:
    """List pinned messages for a group."""
    room = _load_group_or_raise(room_slug)

    # Public groups: anyone can see pins; private groups: need READ_MESSAGES
    if not room.is_public:
        _ensure_authenticated(actor)
        effective = compute_permissions(room, actor)
        if not (effective & Perm.READ_MESSAGES):
            raise GroupForbiddenError("Cannot view pinned messages")

    pins = (
        PinnedMessage.objects.filter(room=room)
        .select_related("message", "message__user", "pinned_by")
        .order_by("-pinned_at")
    )

    return [
        {
            "messageId": p.message_id,
            "content": p.message.message_content,
            "author": p.message.user.username if p.message.user else p.message.username,
            "pinnedBy": p.pinned_by.username if p.pinned_by else None,
            "pinnedAt": p.pinned_at.isoformat(),
            "createdAt": p.message.date_added.isoformat(),
        }
        for p in pins
    ]
