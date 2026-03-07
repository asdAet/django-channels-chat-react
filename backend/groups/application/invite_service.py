"""Invite link management for groups."""

from __future__ import annotations

from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.db.models import F
from django.utils import timezone

from chat_app_django.security.audit import audit_security_event
from groups.application.group_service import (
    GroupConflictError,
    GroupError,
    GroupForbiddenError,
    GroupNotFoundError,
    _ensure_authenticated,
    _ensure_group_permission,
    _load_group_or_raise,
)
from groups.domain import rules as group_rules
from groups.infrastructure.models import InviteLink, JoinRequest
from roles.application.permission_service import compute_permissions
from roles.models import Membership, Role
from roles.permissions import Perm
from rooms.models import Room


def create_invite(
    actor,
    room_slug: str,
    *,
    name: str = "",
    expires_in_seconds: int | None = None,
    max_uses: int = 0,
) -> InviteLink:
    """Create an invite link for a group."""
    _ensure_authenticated(actor)
    room = _load_group_or_raise(room_slug)

    effective = compute_permissions(room, actor)
    if not (effective & (Perm.INVITE_USERS | Perm.MANAGE_INVITES | Perm.ADMINISTRATOR)):
        raise GroupForbiddenError("Missing permission to create invites")

    max_invites = getattr(settings, "GROUP_MAX_INVITES_PER_ROOM", 50)
    active_count = InviteLink.objects.filter(room=room, is_revoked=False).count()
    if active_count >= max_invites:
        raise GroupError(f"Maximum of {max_invites} active invite links per group")

    expires_at = None
    if expires_in_seconds is not None and expires_in_seconds > 0:
        expires_at = timezone.now() + timedelta(seconds=expires_in_seconds)

    code = group_rules.generate_invite_code()

    invite = InviteLink.objects.create(
        room=room,
        code=code,
        created_by=actor,
        name=name[:100],
        expires_at=expires_at,
        max_uses=max(0, max_uses),
    )

    audit_security_event(
        "group.invite.created",
        actor_user=actor,
        actor_user_id=getattr(actor, "pk", None),
        actor_username=getattr(actor, "username", None),
        is_authenticated=True,
        room_slug=room.slug,
        invite_code=code,
    )
    return invite


def list_invites(actor, room_slug: str) -> list[InviteLink]:
    """List all invite links for a group. Requires MANAGE_INVITES."""
    _ensure_authenticated(actor)
    room = _load_group_or_raise(room_slug)
    _ensure_group_permission(room, actor, Perm.MANAGE_INVITES)
    return list(InviteLink.objects.filter(room=room).select_related("created_by"))


def revoke_invite(actor, room_slug: str, invite_code: str) -> None:
    """Revoke an invite link. Requires MANAGE_INVITES."""
    _ensure_authenticated(actor)
    room = _load_group_or_raise(room_slug)
    _ensure_group_permission(room, actor, Perm.MANAGE_INVITES)

    invite = InviteLink.objects.filter(room=room, code=invite_code).first()
    if not invite:
        raise GroupNotFoundError("Invite link not found")

    invite.is_revoked = True
    invite.save(update_fields=["is_revoked"])

    audit_security_event(
        "group.invite.revoked",
        actor_user=actor,
        actor_user_id=getattr(actor, "pk", None),
        actor_username=getattr(actor, "username", None),
        is_authenticated=True,
        room_slug=room.slug,
        invite_code=invite_code,
    )


def get_invite_info(invite_code: str) -> dict:
    """Get public preview of an invite link (no auth required)."""
    invite = (
        InviteLink.objects.filter(code=invite_code)
        .select_related("room")
        .first()
    )
    if not invite:
        raise GroupNotFoundError("Invite link not found")

    if invite.is_expired:
        raise GroupError("This invite link has expired")

    room = invite.room
    return {
        "code": invite.code,
        "groupSlug": room.slug,
        "groupName": room.name,
        "groupDescription": room.description[:200],
        "memberCount": room.member_count,
        "isPublic": room.is_public,
    }


def join_via_invite(actor, invite_code: str) -> dict:
    """Join a group using an invite link."""
    _ensure_authenticated(actor)

    invite = (
        InviteLink.objects.filter(code=invite_code)
        .select_related("room")
        .first()
    )
    if not invite:
        raise GroupNotFoundError("Invite link not found")

    if invite.is_expired:
        raise GroupError("This invite link has expired")

    room = invite.room
    group_rules.ensure_is_group(room)

    # Check if already a member
    existing = Membership.objects.filter(room=room, user=actor).first()
    if existing:
        if existing.is_banned:
            raise GroupForbiddenError("You are banned from this group")
        return {"roomSlug": room.slug, "status": "already_member"}

    # Check max members
    if room.member_count >= room.max_members:
        raise GroupError("This group has reached its member limit")

    with transaction.atomic():
        # Increment use count
        InviteLink.objects.filter(pk=invite.pk).update(use_count=F("use_count") + 1)

        if room.join_approval_required:
            JoinRequest.objects.update_or_create(
                room=room,
                user=actor,
                status=JoinRequest.Status.PENDING,
                defaults={"invite_link": invite},
            )
            status = "pending"
        else:
            membership = Membership.objects.create(room=room, user=actor)
            member_role = Role.objects.filter(room=room, name="Member").first()
            if member_role:
                membership.roles.add(member_role)
            Room.objects.filter(pk=room.pk).update(member_count=F("member_count") + 1)
            status = "joined"

    audit_security_event(
        "group.invite.used",
        actor_user=actor,
        actor_user_id=getattr(actor, "pk", None),
        actor_username=getattr(actor, "username", None),
        is_authenticated=True,
        room_slug=room.slug,
        invite_code=invite_code,
        status=status,
    )
    return {"roomSlug": room.slug, "status": status}
