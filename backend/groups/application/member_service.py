"""Group member management: join, leave, kick, ban, mute."""

from __future__ import annotations

from datetime import timedelta

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction
from django.db.models import F
from django.utils import timezone

from chat_app_django.media_utils import build_profile_url_from_request, serialize_avatar_crop
from chat_app_django.security.audit import audit_security_event
from groups.application.group_service import (
    GroupError,
    GroupForbiddenError,
    GroupNotFoundError,
    _ensure_authenticated,
    _load_group_or_raise,
)
from django.contrib.auth import get_user_model

from groups.infrastructure.models import JoinRequest
from roles.application.permission_service import (
    compute_permissions,
    get_actor_context,
    has_permission,
)
from roles.domain.rules import can_manage_target
from roles.models import Membership, Role
from roles.permissions import Perm
from rooms.models import Room
from users.identity import user_public_username

User = get_user_model()


def _broadcast_membership_revoked(room: Room, target_user_id: int) -> None:
    """Force-close active chat sockets for a user in the room."""
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return
    room_id = getattr(room, "pk", None)
    if room_id is None:
        return
    group_name = f"chat_room_{int(room_id)}"
    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            "type": "chat_membership_revoked",
            "targetUserId": int(target_user_id),
        },
    )


def _schedule_membership_revoked(room: Room, target_user_id: int) -> None:
    transaction.on_commit(
        lambda: _broadcast_membership_revoked(room, int(target_user_id))
    )


def _get_membership_or_raise(room: Room, user) -> Membership:
    membership = Membership.objects.filter(room=room, user=user).first()
    if not membership:
        raise GroupNotFoundError("Участник не найден")
    return membership


def _get_target_top_position(membership: Membership) -> int:
    top_role = membership.roles.order_by("-position").first()
    return int(top_role.position) if top_role else 0


def _ensure_hierarchy(room: Room, actor, target_membership: Membership) -> None:
    """Ensure actor's top role position > target's top role position."""
    actor_ctx = get_actor_context(room, actor)
    target_pos = _get_target_top_position(target_membership)
    if not can_manage_target(
        actor_top_position=actor_ctx.top_position,
        target_position=target_pos,
    ):
        raise GroupForbiddenError("Нельзя управлять участником вашего уровня или выше")


def _ensure_not_self(actor, target_user_id: int) -> None:
    actor_id = getattr(actor, "pk", None)
    if actor_id is None:
        return
    if int(actor_id) == int(target_user_id):
        raise GroupError("Нельзя применить это действие к самому себе")


def join_group(actor, room_id: int) -> Membership:
    """Join a public group directly."""
    _ensure_authenticated(actor)
    room = _load_group_or_raise(room_id)

    if not room.is_public:
        raise GroupForbiddenError("Для вступления в эту группу требуется ссылка-приглашение")

    with transaction.atomic():
        existing = Membership.objects.select_for_update().filter(
            room=room, user=actor
        ).first()
        if existing:
            if existing.is_banned:
                raise GroupForbiddenError("Вы заблокированы в этой группе")
            return existing  # already a member

        room = Room.objects.select_for_update().get(pk=room.pk)
        if room.member_count >= room.max_members:
            raise GroupError("В этой группе достигнут лимит участников")

        if room.join_approval_required:
            JoinRequest.objects.update_or_create(
                room=room,
                user=actor,
                status=JoinRequest.Status.PENDING,
            )
            raise GroupError("Ваша заявка на вступление отправлена на рассмотрение")

        membership = Membership.objects.create(room=room, user=actor)
        member_role = Role.objects.filter(room=room, name=Role.MEMBER).first()
        if member_role:
            membership.roles.add(member_role)
        Room.objects.filter(pk=room.pk).update(member_count=F("member_count") + 1)

    audit_security_event(
        "group.member.joined",
        actor_user=actor,
        actor_user_id=getattr(actor, "pk", None),
        actor_username=user_public_username(actor),
        is_authenticated=True,
        room_id=room.pk,
    )
    return membership


def leave_group(actor, room_id: int) -> None:
    """Leave a group. Owners cannot leave without transferring ownership."""
    _ensure_authenticated(actor)
    room = _load_group_or_raise(room_id)

    membership = _get_membership_or_raise(room, actor)

    # Owners must transfer ownership before leaving.
    owner_role = Role.objects.filter(room=room, name=Role.OWNER).first()
    if owner_role and membership.roles.filter(pk=owner_role.pk).exists():
        raise GroupError("Владелец не может покинуть группу без передачи владения")

    with transaction.atomic():
        membership.delete()
        Room.objects.filter(pk=room.pk).update(
            member_count=F("member_count") - 1
        )

    audit_security_event(
        "group.member.left",
        actor_user=actor,
        actor_user_id=getattr(actor, "pk", None),
        actor_username=user_public_username(actor),
        is_authenticated=True,
        room_id=room.pk,
    )


def kick_member(actor, room_id: int, target_user_id: int) -> None:
    """Kick a member from the group."""
    _ensure_authenticated(actor)
    room = _load_group_or_raise(room_id)
    _ensure_not_self(actor, int(target_user_id))

    if not has_permission(room, actor, Perm.KICK_MEMBERS):
        raise GroupForbiddenError("Отсутствует разрешение KICK_MEMBERS")

    target_membership = Membership.objects.filter(
        room=room, user_id=int(target_user_id)
    ).first()
    if not target_membership:
        raise GroupNotFoundError("Участник не найден")

    _ensure_hierarchy(room, actor, target_membership)

    target_username = user_public_username(target_membership.user)
    with transaction.atomic():
        was_active = not target_membership.is_banned
        target_membership.delete()
        if was_active:
            Room.objects.filter(pk=room.pk).update(
                member_count=F("member_count") - 1
            )
        _schedule_membership_revoked(room, int(target_user_id))

    audit_security_event(
        "group.member.kicked",
        actor_user=actor,
        actor_user_id=getattr(actor, "pk", None),
        actor_username=user_public_username(actor),
        is_authenticated=True,
        room_id=room.pk,
        target_user_id=target_user_id,
        target_username=target_username,
    )


def ban_member(
    actor,
    room_id: int,
    target_user_id: int,
    *,
    reason: str = "",
) -> None:
    """Ban a member from the group."""
    _ensure_authenticated(actor)
    room = _load_group_or_raise(room_id)
    _ensure_not_self(actor, int(target_user_id))

    if not has_permission(room, actor, Perm.BAN_MEMBERS):
        raise GroupForbiddenError("Отсутствует разрешение BAN_MEMBERS")

    target_membership = Membership.objects.filter(
        room=room, user_id=int(target_user_id)
    ).first()
    if not target_membership:
        # Validate target user exists before creating pre-emptive ban
        if not User.objects.filter(pk=int(target_user_id)).exists():
            raise GroupNotFoundError("Пользователь не найден")
        target_membership = Membership.objects.create(
            room=room,
            user_id=int(target_user_id),
            is_banned=True,
            ban_reason=reason,
            banned_by=actor,
        )
        audit_security_event(
            "group.member.banned",
            actor_user=actor,
            actor_user_id=getattr(actor, "pk", None),
            actor_username=user_public_username(actor),
            is_authenticated=True,
            room_id=room.pk,
            target_user_id=target_user_id,
            reason=reason,
        )
        return

    _ensure_hierarchy(room, actor, target_membership)

    with transaction.atomic():
        was_active = not target_membership.is_banned
        target_membership.is_banned = True
        target_membership.ban_reason = reason
        target_membership.banned_by = actor
        target_membership.save(update_fields=["is_banned", "ban_reason", "banned_by"])

        if was_active:
            Room.objects.filter(pk=room.pk).update(
                member_count=F("member_count") - 1
            )

        _schedule_membership_revoked(room, int(target_user_id))

    audit_security_event(
        "group.member.banned",
        actor_user=actor,
        actor_user_id=getattr(actor, "pk", None),
        actor_username=user_public_username(actor),
        is_authenticated=True,
        room_id=room.pk,
        target_user_id=target_user_id,
        reason=reason,
    )


def unban_member(actor, room_id: int, target_user_id: int) -> None:
    """Unban a member from the group."""
    _ensure_authenticated(actor)
    room = _load_group_or_raise(room_id)

    if not has_permission(room, actor, Perm.BAN_MEMBERS):
        raise GroupForbiddenError("Отсутствует разрешение BAN_MEMBERS")

    membership = Membership.objects.filter(
        room=room, user_id=int(target_user_id), is_banned=True
    ).first()
    if not membership:
        raise GroupNotFoundError("Заблокированный участник не найден")

    with transaction.atomic():
        membership.delete()

    audit_security_event(
        "group.member.unbanned",
        actor_user=actor,
        actor_user_id=getattr(actor, "pk", None),
        actor_username=user_public_username(actor),
        is_authenticated=True,
        room_id=room.pk,
        target_user_id=target_user_id,
    )


def mute_member(
    actor,
    room_id: int,
    target_user_id: int,
    *,
    duration_seconds: int,
) -> Membership:
    """Mute a member for a specified duration."""
    _ensure_authenticated(actor)
    room = _load_group_or_raise(room_id)
    _ensure_not_self(actor, int(target_user_id))

    if not has_permission(room, actor, Perm.MUTE_MEMBERS):
        raise GroupForbiddenError("Отсутствует разрешение MUTE_MEMBERS")

    if duration_seconds < 1:
        raise GroupError("Длительность мута должна быть не менее 1 секунды")
    if duration_seconds > 366 * 86400:  # ~1 year max
        raise GroupError("Длительность мута не может превышать 1 год")

    target_membership = Membership.objects.filter(
        room=room, user_id=int(target_user_id)
    ).first()
    if not target_membership:
        raise GroupNotFoundError("Участник не найден")

    _ensure_hierarchy(room, actor, target_membership)

    target_membership.muted_until = timezone.now() + timedelta(seconds=duration_seconds)
    target_membership.muted_by = actor
    target_membership.save(update_fields=["muted_until", "muted_by"])

    audit_security_event(
        "group.member.muted",
        actor_user=actor,
        actor_user_id=getattr(actor, "pk", None),
        actor_username=user_public_username(actor),
        is_authenticated=True,
        room_id=room.pk,
        target_user_id=target_user_id,
        duration_seconds=duration_seconds,
    )
    return target_membership


def unmute_member(actor, room_id: int, target_user_id: int) -> Membership:
    """Unmute a member."""
    _ensure_authenticated(actor)
    room = _load_group_or_raise(room_id)
    _ensure_not_self(actor, int(target_user_id))

    if not has_permission(room, actor, Perm.MUTE_MEMBERS):
        raise GroupForbiddenError("Отсутствует разрешение MUTE_MEMBERS")

    target_membership = Membership.objects.filter(
        room=room, user_id=int(target_user_id)
    ).first()
    if not target_membership:
        raise GroupNotFoundError("Участник не найден")

    target_membership.muted_until = None
    target_membership.muted_by = None
    target_membership.save(update_fields=["muted_until", "muted_by"])

    audit_security_event(
        "group.member.unmuted",
        actor_user=actor,
        actor_user_id=getattr(actor, "pk", None),
        actor_username=user_public_username(actor),
        is_authenticated=True,
        room_id=room.pk,
        target_user_id=target_user_id,
    )
    return target_membership


def list_members(
    actor,
    room_id: int,
    *,
    before_id: int | None = None,
    limit: int = 50,
    request=None,
) -> dict:
    """List group members with their roles."""
    _ensure_authenticated(actor)
    room = _load_group_or_raise(room_id)
    limit = max(1, min(int(limit), 200))

    if not has_permission(room, actor, Perm.READ_MESSAGES):
        raise GroupForbiddenError("Нет доступа к просмотру участников")

    qs = (
        Membership.objects.filter(room=room, is_banned=False)
        .select_related("user", "user__profile")
        .prefetch_related("roles")
    )

    total = qs.count()
    if before_id is not None:
        qs = qs.filter(id__lt=int(before_id))
    batch = list(qs.order_by("-id")[: limit + 1])
    has_more = len(batch) > limit
    if has_more:
        batch = batch[:limit]
    next_before = int(batch[-1].pk) if has_more and batch else None

    actor_user_id = getattr(actor, "pk", None)

    def _member_dict(m):
        profile = getattr(m.user, "profile", None)
        profile_image = None
        avatar_crop = None
        if profile:
            image = getattr(profile, "image", None)
            if image:
                image_name = getattr(image, "name", "")
                if image_name:
                    if request is not None:
                        profile_image = build_profile_url_from_request(request, image_name)
                    else:
                        try:
                            profile_image = image.url
                        except (AttributeError, ValueError):
                            profile_image = None
            avatar_crop = serialize_avatar_crop(profile)
        return {
            "userId": m.user_id,
            "username": user_public_username(m.user),
            "nickname": m.nickname or None,
            "profileImage": profile_image,
            "avatarCrop": avatar_crop,
            "roles": [
                {"id": r.pk, "name": r.name, "color": r.color}
                for r in m.roles.all()
            ],
            "joinedAt": m.joined_at.isoformat(),
            "isMuted": m.is_muted,
            "isSelf": bool(
                actor_user_id is not None and int(actor_user_id) == int(m.user_id)
            ),
        }

    return {
        "items": [_member_dict(m) for m in batch],
        "total": total,
        "pagination": {
            "limit": limit,
            "hasMore": has_more,
            "nextBefore": next_before,
        },
    }


def list_banned(
    actor,
    room_id: int,
    *,
    before_id: int | None = None,
    limit: int = 50,
) -> dict:
    """List banned members. Requires BAN_MEMBERS permission."""
    _ensure_authenticated(actor)
    room = _load_group_or_raise(room_id)
    limit = max(1, min(int(limit), 200))

    if not has_permission(room, actor, Perm.BAN_MEMBERS):
        raise GroupForbiddenError("Отсутствует разрешение BAN_MEMBERS")

    qs = (
        Membership.objects.filter(room=room, is_banned=True)
        .select_related("user", "banned_by")
    )

    total = qs.count()
    if before_id is not None:
        qs = qs.filter(id__lt=int(before_id))
    batch = list(qs.order_by("-id")[: limit + 1])
    has_more = len(batch) > limit
    if has_more:
        batch = batch[:limit]
    next_before = int(batch[-1].pk) if has_more and batch else None

    return {
        "items": [
            {
                "userId": m.user_id,
                "username": user_public_username(m.user),
                "reason": m.ban_reason,
                "bannedBy": user_public_username(m.banned_by) if m.banned_by else None,
            }
            for m in batch
        ],
        "total": total,
        "pagination": {
            "limit": limit,
            "hasMore": has_more,
            "nextBefore": next_before,
        },
    }


def approve_join_request(actor, room_id: int, request_id: int) -> Membership:
    """Approve a pending join request."""
    _ensure_authenticated(actor)
    room = _load_group_or_raise(room_id)

    if not has_permission(room, actor, Perm.KICK_MEMBERS):
        raise GroupForbiddenError("Отсутствует разрешение на управление заявками на вступление")

    join_req = JoinRequest.objects.filter(
        pk=int(request_id), room=room, status=JoinRequest.Status.PENDING
    ).select_related("user").first()
    if not join_req:
        raise GroupNotFoundError("Заявка на вступление не найдена")

    with transaction.atomic():
        join_req.status = JoinRequest.Status.APPROVED
        join_req.reviewed_by = actor
        join_req.reviewed_at = timezone.now()
        join_req.save(update_fields=["status", "reviewed_by", "reviewed_at"])

        membership, created = Membership.objects.get_or_create(
            room=room, user=join_req.user
        )
        was_banned = membership.is_banned
        if was_banned:
            membership.is_banned = False
            membership.ban_reason = ""
            membership.banned_by = None
            membership.save(update_fields=["is_banned", "ban_reason", "banned_by"])

        member_role = Role.objects.filter(room=room, name=Role.MEMBER).first()
        if member_role:
            membership.roles.add(member_role)

        if created or was_banned:
            Room.objects.filter(pk=room.pk).update(
                member_count=F("member_count") + 1
            )

    audit_security_event(
        "group.join_request.approved",
        actor_user=actor,
        actor_user_id=getattr(actor, "pk", None),
        actor_username=user_public_username(actor),
        is_authenticated=True,
        room_id=room.pk,
        request_id=request_id,
        target_user_id=join_req.user_id,
    )
    return membership


def reject_join_request(actor, room_id: int, request_id: int) -> None:
    """Reject a pending join request."""
    _ensure_authenticated(actor)
    room = _load_group_or_raise(room_id)

    if not has_permission(room, actor, Perm.KICK_MEMBERS):
        raise GroupForbiddenError("Отсутствует разрешение на управление заявками на вступление")

    join_req = JoinRequest.objects.filter(
        pk=int(request_id), room=room, status=JoinRequest.Status.PENDING
    ).first()
    if not join_req:
        raise GroupNotFoundError("Заявка на вступление не найдена")

    join_req.status = JoinRequest.Status.REJECTED
    join_req.reviewed_by = actor
    join_req.reviewed_at = timezone.now()
    join_req.save(update_fields=["status", "reviewed_by", "reviewed_at"])

    audit_security_event(
        "group.join_request.rejected",
        actor_user=actor,
        actor_user_id=getattr(actor, "pk", None),
        actor_username=user_public_username(actor),
        is_authenticated=True,
        room_id=room.pk,
        request_id=request_id,
    )


def list_join_requests(actor, room_id: int) -> list[dict]:
    """List pending join requests."""
    _ensure_authenticated(actor)
    room = _load_group_or_raise(room_id)

    if not has_permission(room, actor, Perm.KICK_MEMBERS):
        raise GroupForbiddenError("Отсутствует разрешение на просмотр заявок на вступление")

    requests = (
        JoinRequest.objects.filter(room=room, status=JoinRequest.Status.PENDING)
        .select_related("user")
        .order_by("-created_at")
    )
    return [
        {
            "id": r.pk,
            "userId": r.user_id,
            "username": user_public_username(r.user),
            "message": r.message,
            "createdAt": r.created_at.isoformat(),
        }
        for r in requests
    ]


