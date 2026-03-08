"""Business logic for message operations: edit, delete, reactions, read state."""

from __future__ import annotations

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from messages.models import Message, MessageReadState, Reaction
from roles.access import has_permission
from roles.permissions import Perm
from rooms.models import Room


# ── Exceptions ─────────────────────────────────────────────────────────

class MessageError(Exception):
    pass


class MessageNotFoundError(MessageError):
    pass


class MessageForbiddenError(MessageError):
    pass


class MessageValidationError(MessageError):
    pass


# ── Edit / Delete ──────────────────────────────────────────────────────

def _load_message_or_raise(room: Room, message_id: int) -> Message:
    msg = (
        Message.objects
        .select_for_update()
        .filter(pk=message_id, room=room, is_deleted=False)
        .first()
    )
    if not msg:
        raise MessageNotFoundError("Message not found")
    return msg


def _can_manage_message(room: Room, user, message: Message) -> bool:
    """Check if user can edit/delete this message (author or moderator)."""
    if message.user_id == user.pk:
        return True
    return has_permission(room, user, Perm.MANAGE_MESSAGES)


def _within_edit_window(message: Message) -> bool:
    window = int(getattr(settings, "CHAT_MESSAGE_EDIT_WINDOW_SECONDS", 900))
    if window == 0:
        return True
    elapsed = (timezone.now() - message.date_added).total_seconds()
    return elapsed <= window


def edit_message(user, room: Room, message_id: int, new_content: str) -> Message:
    """Edit a message. Returns the updated message."""
    new_content = new_content.strip()
    if not new_content:
        raise MessageValidationError("Message content cannot be empty")

    max_len = int(getattr(settings, "CHAT_MESSAGE_MAX_LENGTH", 1000))
    if len(new_content) > max_len:
        raise MessageValidationError("Message too long")

    with transaction.atomic():
        msg = _load_message_or_raise(room, message_id)

        is_author = msg.user_id == user.pk
        is_moderator = has_permission(room, user, Perm.MANAGE_MESSAGES)

        if not is_author and not is_moderator:
            raise MessageForbiddenError("You cannot edit this message")

        if is_author and not is_moderator and not _within_edit_window(msg):
            raise MessageForbiddenError("Edit window has expired")

        if not msg.original_content:
            msg.original_content = msg.message_content

        msg.message_content = new_content
        msg.edited_at = timezone.now()
        msg.save(update_fields=["message_content", "edited_at", "original_content"])

    return msg


def delete_message(user, room: Room, message_id: int) -> Message:
    """Soft-delete a message. Returns the deleted message."""
    with transaction.atomic():
        msg = _load_message_or_raise(room, message_id)

        if not _can_manage_message(room, user, msg):
            raise MessageForbiddenError("You cannot delete this message")

        msg.is_deleted = True
        msg.deleted_at = timezone.now()
        msg.deleted_by = user
        msg.save(update_fields=["is_deleted", "deleted_at", "deleted_by"])

    return msg


# ── Reactions ──────────────────────────────────────────────────────────

def add_reaction(user, room: Room, message_id: int, emoji: str) -> Reaction:
    """Add an emoji reaction to a message. Idempotent."""
    emoji = emoji.strip()
    if not emoji or len(emoji) > 32:
        raise MessageValidationError("Invalid emoji")

    if not has_permission(room, user, Perm.ADD_REACTIONS):
        raise MessageForbiddenError("Missing ADD_REACTIONS permission")

    msg = Message.objects.filter(pk=message_id, room=room, is_deleted=False).first()
    if not msg:
        raise MessageNotFoundError("Message not found")

    reaction, _created = Reaction.objects.get_or_create(
        message=msg, user=user, emoji=emoji,
    )
    return reaction


def remove_reaction(user, room: Room, message_id: int, emoji: str) -> None:
    """Remove an emoji reaction. Idempotent (no error if not found)."""
    Reaction.objects.filter(
        message_id=message_id, message__room=room, user=user, emoji=emoji,
    ).delete()


# ── Read State ─────────────────────────────────────────────────────────

def mark_read(user, room: Room, last_read_message_id: int) -> MessageReadState:
    """Mark messages as read up to the given message ID."""
    if not Message.objects.filter(pk=last_read_message_id, room=room).exists():
        raise MessageNotFoundError("Message not found")

    with transaction.atomic():
        state, created = MessageReadState.objects.select_for_update().get_or_create(
            user=user, room=room,
            defaults={"last_read_message_id": last_read_message_id},
        )
        if not created:
            current_id = state.last_read_message_id or 0
            if last_read_message_id > current_id:
                state.last_read_message_id = last_read_message_id
                state.save(update_fields=["last_read_message_id", "last_read_at"])

    return state


def get_unread_counts(user) -> list[dict]:
    """Get unread message counts for all rooms the user is a member of."""
    from roles.models import Membership

    memberships = (
        Membership.objects.filter(user=user, is_banned=False)
        .select_related("room")
    )

    result = []
    for ms in memberships:
        room = ms.room
        read_state = MessageReadState.objects.filter(user=user, room=room).first()
        last_read_id = read_state.last_read_message_id if read_state else 0
        unread = (
            Message.objects
            .filter(room=room, is_deleted=False, id__gt=(last_read_id or 0))
            .exclude(user=user)
            .count()
        )
        if unread > 0:
            result.append({"roomSlug": room.slug, "unreadCount": unread})

    return result
