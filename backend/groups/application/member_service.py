"""Group member management: join, leave, kick, ban, mute."""

from __future__ import annotations

from datetime import timedelta

from django.db import transaction
from django.db.models import F
from django.utils import timezone

from chat_app_django.security.audit import audit_security_event
from groups.application.group_service import (
    GroupError,
    GroupForbiddenError,
    GroupNotFoundError,
    _ensure_authenticated,
    _load_group_or_raise,
)
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


def _get_membership_or_raise(room: Room, user) -> Membership:
    membership = Membership.objects.filter(room=room, user=user).first()
    if not membership:
        raise GroupNotFoundError("Member not found")
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
        raise GroupForbiddenError("Cannot manage a member at your level or higher")


def join_group(actor, room_slug: str) -> Membership:
    """Join a public group directly."""
    _ensure_authenticated(actor)
    room = _load_group_or_raise(room_slug)

    if not room.is_public:
        raise GroupForbiddenError("This group requires an invite link to join")

    existing = Membership.objects.filter(room=room, user=actor).first()
    if existing:
        if existing.is_banned:
            raise GroupForbiddenError("You are banned from this group")
        return existing  # already a member

    if room.member_count >= room.max_members:
        raise GroupError("This group has reached its member limit")

    with transaction.atomic():
        if room.join_approval_required:
            JoinRequest.objects.update_or_create(
                room=room,
                user=actor,
                status=JoinRequest.Status.PENDING,
            )
            raise GroupError("Your join request has been submitted for approval")

        membership = Membership.objects.create(room=room, user=actor)
        member_role = Role.objects.filter(room=room, name="Member").first()
        if member_role:
            membership.roles.add(member_role)
        Room.objects.filter(pk=room.pk).update(member_count=F("member_count") + 1)

    audit_security_event(
        "group.member.joined",
        actor_user=actor,
        actor_user_id=getattr(actor, "pk", None),
        actor_username=getattr(actor, "username", None),
        is_authenticated=True,
        room_slug=room.slug,
    )
    return membership


def leave_group(actor, room_slug: str) -> None:
    """Leave a group. Owners cannot leave without transferring ownership."""
    _ensure_authenticated(actor)
    room = _load_group_or_raise(room_slug)

    membership = _get_membership_or_raise(room, actor)

    # Check if actor is the owner
    owner_role = Role.objects.filter(room=room, name="Owner").first()
    if owner_role and membership.roles.filter(pk=owner_role.pk).exists():
        raise GroupError("Owner must transfer ownership before leaving")

    with transaction.atomic():
        membership.delete()
        Room.objects.filter(pk=room.pk).update(
            member_count=F("member_count") - 1
        )

    audit_security_event(
        "group.member.left",
        actor_user=actor,
        actor_user_id=getattr(actor, "pk", None),
        actor_username=getattr(actor, "username", None),
        is_authenticated=True,
        room_slug=room.slug,
    )


def kick_member(actor, room_slug: str, target_user_id: int) -> None:
    """Kick a member from the group."""
    _ensure_authenticated(actor)
    room = _load_group_or_raise(room_slug)

    if not has_permission(room, actor, Perm.KICK_MEMBERS):
        raise GroupForbiddenError("Missing KICK_MEMBERS permission")

    target_membership = Membership.objects.filter(
        room=room, user_id=int(target_user_id)
    ).first()
    if not target_membership:
        raise GroupNotFoundError("Member not found")

    _ensure_hierarchy(room, actor, target_membership)

    target_username = target_membership.user.username
    with transaction.atomic():
        target_membership.delete()
        Room.objects.filter(pk=room.pk).update(
            member_count=F("member_count") - 1
        )

    audit_security_event(
        "group.member.kicked",
        actor_user=actor,
        actor_user_id=getattr(actor, "pk", None),
        actor_username=getattr(actor, "username", None),
        is_authenticated=True,
        room_slug=room.slug,
        target_user_id=target_user_id,
        target_username=target_username,
    )


def ban_member(
    actor,
    room_slug: str,
    target_user_id: int,
    *,
    reason: str = "",
) -> None:
    """Ban a member from the group."""
    _ensure_authenticated(actor)
    room = _load_group_or_raise(room_slug)

    if not has_permission(room, actor, Perm.BAN_MEMBERS):
        raise GroupForbiddenError("Missing BAN_MEMBERS permission")

    target_membership = Membership.objects.filter(
        room=room, user_id=int(target_user_id)
    ).first()
    if not target_membership:
        # Create a banned membership to prevent rejoining
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
            actor_username=getattr(actor, "username", None),
            is_authenticated=True,
            room_slug=room.slug,
            target_user_id=target_user_id,
            reason=reason,
        )
        return

    _ensure_hierarchy(room, actor, target_membership)

    was_active = not target_membership.is_banned
    target_membership.is_banned = True
    target_membership.ban_reason = reason
    target_membership.banned_by = actor
    target_membership.save(update_fields=["is_banned", "ban_reason", "banned_by"])

    if was_active:
        Room.objects.filter(pk=room.pk).update(
            member_count=F("member_count") - 1
        )

    audit_security_event(
        "group.member.banned",
        actor_user=actor,
        actor_user_id=getattr(actor, "pk", None),
        actor_username=getattr(actor, "username", None),
        is_authenticated=True,
        room_slug=room.slug,
        target_user_id=target_user_id,
        reason=reason,
    )


def unban_member(actor, room_slug: str, target_user_id: int) -> None:
    """Unban a member from the group."""
    _ensure_authenticated(actor)
    room = _load_group_or_raise(room_slug)

    if not has_permission(room, actor, Perm.BAN_MEMBERS):
        raise GroupForbiddenError("Missing BAN_MEMBERS permission")

    membership = Membership.objects.filter(
        room=room, user_id=int(target_user_id), is_banned=True
    ).first()
    if not membership:
        raise GroupNotFoundError("Banned member not found")

    membership.is_banned = False
    membership.ban_reason = ""
    membership.banned_by = None
    membership.save(update_fields=["is_banned", "ban_reason", "banned_by"])

    audit_security_event(
        "group.member.unbanned",
        actor_user=actor,
        actor_user_id=getattr(actor, "pk", None),
        actor_username=getattr(actor, "username", None),
        is_authenticated=True,
        room_slug=room.slug,
        target_user_id=target_user_id,
    )


def mute_member(
    actor,
    room_slug: str,
    target_user_id: int,
    *,
    duration_seconds: int,
) -> Membership:
    """Mute a member for a specified duration."""
    _ensure_authenticated(actor)
    room = _load_group_or_raise(room_slug)

    if not has_permission(room, actor, Perm.MUTE_MEMBERS):
        raise GroupForbiddenError("Missing MUTE_MEMBERS permission")

    if duration_seconds < 1:
        raise GroupError("Mute duration must be at least 1 second")
    if duration_seconds > 366 * 86400:  # ~1 year max
        raise GroupError("Mute duration cannot exceed 1 year")

    target_membership = Membership.objects.filter(
        room=room, user_id=int(target_user_id)
    ).first()
    if not target_membership:
        raise GroupNotFoundError("Member not found")

    _ensure_hierarchy(room, actor, target_membership)

    target_membership.muted_until = timezone.now() + timedelta(seconds=duration_seconds)
    target_membership.muted_by = actor
    target_membership.save(update_fields=["muted_until", "muted_by"])

    audit_security_event(
        "group.member.muted",
        actor_user=actor,
        actor_user_id=getattr(actor, "pk", None),
        actor_username=getattr(actor, "username", None),
        is_authenticated=True,
        room_slug=room.slug,
        target_user_id=target_user_id,
        duration_seconds=duration_seconds,
    )
    return target_membership


def unmute_member(actor, room_slug: str, target_user_id: int) -> Membership:
    """Unmute a member."""
    _ensure_authenticated(actor)
    room = _load_group_or_raise(room_slug)

    if not has_permission(room, actor, Perm.MUTE_MEMBERS):
        raise GroupForbiddenError("Missing MUTE_MEMBERS permission")

    target_membership = Membership.objects.filter(
        room=room, user_id=int(target_user_id)
    ).first()
    if not target_membership:
        raise GroupNotFoundError("Member not found")

    target_membership.muted_until = None
    target_membership.muted_by = None
    target_membership.save(update_fields=["muted_until", "muted_by"])

    audit_security_event(
        "group.member.unmuted",
        actor_user=actor,
        actor_user_id=getattr(actor, "pk", None),
        actor_username=getattr(actor, "username", None),
        is_authenticated=True,
        room_slug=room.slug,
        target_user_id=target_user_id,
    )
    return target_membership


def list_members(
    actor, room_slug: str, *, page: int = 1, page_size: int = 50
) -> dict:
    """List group members with their roles."""
    _ensure_authenticated(actor)
    room = _load_group_or_raise(room_slug)

    if not has_permission(room, actor, Perm.READ_MESSAGES):
        raise GroupForbiddenError("Cannot view members")

    qs = (
        Membership.objects.filter(room=room, is_banned=False)
        .select_related("user", "user__profile")
        .prefetch_related("roles")
        .order_by("-roles__position", "joined_at")
    )

    total = qs.count()
    offset = (max(1, page) - 1) * page_size
    members = list(qs[offset : offset + page_size])

    return {
        "items": [
            {
                "userId": m.user_id,
                "username": m.user.username,
                "nickname": m.nickname or None,
                "roles": [
                    {"id": r.pk, "name": r.name, "color": r.color}
                    for r in m.roles.all()
                ],
                "joinedAt": m.joined_at.isoformat(),
                "isMuted": m.is_muted,
            }
            for m in members
        ],
        "total": total,
        "page": page,
        "pageSize": page_size,
    }


def list_banned(actor, room_slug: str) -> list[dict]:
    """List banned members. Requires BAN_MEMBERS permission."""
    _ensure_authenticated(actor)
    room = _load_group_or_raise(room_slug)

    if not has_permission(room, actor, Perm.BAN_MEMBERS):
        raise GroupForbiddenError("Missing BAN_MEMBERS permission")

    banned = (
        Membership.objects.filter(room=room, is_banned=True)
        .select_related("user", "banned_by")
        .order_by("-joined_at")
    )
    return [
        {
            "userId": m.user_id,
            "username": m.user.username,
            "reason": m.ban_reason,
            "bannedBy": m.banned_by.username if m.banned_by else None,
        }
        for m in banned
    ]


def approve_join_request(actor, room_slug: str, request_id: int) -> Membership:
    """Approve a pending join request."""
    _ensure_authenticated(actor)
    room = _load_group_or_raise(room_slug)

    if not has_permission(room, actor, Perm.KICK_MEMBERS):
        raise GroupForbiddenError("Missing permission to manage join requests")

    join_req = JoinRequest.objects.filter(
        pk=int(request_id), room=room, status=JoinRequest.Status.PENDING
    ).select_related("user").first()
    if not join_req:
        raise GroupNotFoundError("Join request not found")

    with transaction.atomic():
        join_req.status = JoinRequest.Status.APPROVED
        join_req.reviewed_by = actor
        join_req.reviewed_at = timezone.now()
        join_req.save(update_fields=["status", "reviewed_by", "reviewed_at"])

        membership, created = Membership.objects.get_or_create(
            room=room, user=join_req.user
        )
        if membership.is_banned:
            membership.is_banned = False
            membership.ban_reason = ""
            membership.banned_by = None
            membership.save(update_fields=["is_banned", "ban_reason", "banned_by"])

        member_role = Role.objects.filter(room=room, name="Member").first()
        if member_role:
            membership.roles.add(member_role)

        if created:
            Room.objects.filter(pk=room.pk).update(
                member_count=F("member_count") + 1
            )

    audit_security_event(
        "group.join_request.approved",
        actor_user=actor,
        actor_user_id=getattr(actor, "pk", None),
        actor_username=getattr(actor, "username", None),
        is_authenticated=True,
        room_slug=room.slug,
        request_id=request_id,
        target_user_id=join_req.user_id,
    )
    return membership


def reject_join_request(actor, room_slug: str, request_id: int) -> None:
    """Reject a pending join request."""
    _ensure_authenticated(actor)
    room = _load_group_or_raise(room_slug)

    if not has_permission(room, actor, Perm.KICK_MEMBERS):
        raise GroupForbiddenError("Missing permission to manage join requests")

    join_req = JoinRequest.objects.filter(
        pk=int(request_id), room=room, status=JoinRequest.Status.PENDING
    ).first()
    if not join_req:
        raise GroupNotFoundError("Join request not found")

    join_req.status = JoinRequest.Status.REJECTED
    join_req.reviewed_by = actor
    join_req.reviewed_at = timezone.now()
    join_req.save(update_fields=["status", "reviewed_by", "reviewed_at"])

    audit_security_event(
        "group.join_request.rejected",
        actor_user=actor,
        actor_user_id=getattr(actor, "pk", None),
        actor_username=getattr(actor, "username", None),
        is_authenticated=True,
        room_slug=room.slug,
        request_id=request_id,
    )


def list_join_requests(actor, room_slug: str) -> list[dict]:
    """List pending join requests."""
    _ensure_authenticated(actor)
    room = _load_group_or_raise(room_slug)

    if not has_permission(room, actor, Perm.KICK_MEMBERS):
        raise GroupForbiddenError("Missing permission to view join requests")

    requests = (
        JoinRequest.objects.filter(room=room, status=JoinRequest.Status.PENDING)
        .select_related("user")
        .order_by("-created_at")
    )
    return [
        {
            "id": r.pk,
            "userId": r.user_id,
            "username": r.user.username,
            "message": r.message,
            "createdAt": r.created_at.isoformat(),
        }
        for r in requests
    ]
