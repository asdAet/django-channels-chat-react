"""Group CRUD operations."""

from __future__ import annotations

from django.db import IntegrityError, transaction
from django.db.models import Q

from chat_app_django.security.audit import audit_security_event
from groups.domain import rules as group_rules
from roles.application.permission_service import compute_permissions, has_permission
from roles.models import Membership, Role
from roles.permissions import Perm
from rooms.models import Room


class GroupError(Exception):
    pass


class GroupNotFoundError(GroupError):
    pass


class GroupForbiddenError(GroupError):
    pass


class GroupConflictError(GroupError):
    pass


def _ensure_authenticated(actor) -> None:
    if not actor or not getattr(actor, "is_authenticated", False):
        raise GroupForbiddenError("Authentication required")


def _load_group_or_raise(room_slug: str) -> Room:
    room = Room.objects.filter(slug=room_slug, kind=Room.Kind.GROUP).first()
    if not room:
        raise GroupNotFoundError("Group not found")
    return room


def _ensure_group_permission(room: Room, actor, perm: Perm) -> None:
    if not has_permission(room, actor, perm):
        audit_security_event(
            "group.permission.denied",
            actor_user=actor,
            actor_user_id=getattr(actor, "pk", None),
            actor_username=getattr(actor, "username", None),
            is_authenticated=True,
            room_slug=room.slug,
            required_permission=perm.name,
        )
        raise GroupForbiddenError(f"Missing {perm.name} permission")


def create_group(
    actor,
    *,
    name: str,
    description: str = "",
    is_public: bool = False,
    username: str | None = None,
) -> Room:
    """Create a new group and assign the creator as Owner."""
    _ensure_authenticated(actor)

    name = group_rules.validate_group_name(name)
    description = group_rules.validate_group_description(description)
    username = group_rules.validate_group_username(username)

    if is_public and not username:
        raise GroupError("Public groups must have a username")

    slug = group_rules.generate_group_slug(name)

    try:
        with transaction.atomic():
            room = Room.objects.create(
                name=name,
                slug=slug,
                kind=Room.Kind.GROUP,
                description=description,
                is_public=is_public,
                username=username,
                created_by=actor,
                member_count=1,
            )
            roles = Role.create_defaults_for_room(room)
            membership = Membership.objects.create(room=room, user=actor)
            owner_role = roles.get("Owner")
            if owner_role:
                membership.roles.add(owner_role)
    except IntegrityError as exc:
        if "username" in str(exc).lower():
            raise GroupConflictError("This username is already taken") from exc
        raise GroupConflictError("Could not create group") from exc

    audit_security_event(
        "group.created",
        actor_user=actor,
        actor_user_id=getattr(actor, "pk", None),
        actor_username=getattr(actor, "username", None),
        is_authenticated=True,
        room_slug=room.slug,
        group_name=name,
        is_public=is_public,
    )
    return room


def update_group(
    actor,
    room_slug: str,
    *,
    name: str | None = None,
    description: str | None = None,
    is_public: bool | None = None,
    username: str | None = ...,  # type: ignore[assignment]
    slow_mode_seconds: int | None = None,
    join_approval_required: bool | None = None,
) -> Room:
    """Update group settings. Requires CHANGE_GROUP_INFO or MANAGE_ROOM."""
    _ensure_authenticated(actor)
    room = _load_group_or_raise(room_slug)

    effective = compute_permissions(room, actor)
    if not (effective & (Perm.CHANGE_GROUP_INFO | Perm.MANAGE_ROOM | Perm.ADMINISTRATOR)):
        raise GroupForbiddenError("Missing permission to edit group info")

    changed_fields: list[str] = []

    if name is not None:
        room.name = group_rules.validate_group_name(name)
        changed_fields.append("name")

    if description is not None:
        room.description = group_rules.validate_group_description(description)
        changed_fields.append("description")

    if is_public is not None:
        room.is_public = is_public
        changed_fields.append("is_public")

    if username is not ...:
        room.username = group_rules.validate_group_username(username)
        changed_fields.append("username")

    if slow_mode_seconds is not None:
        room.slow_mode_seconds = group_rules.validate_slow_mode(slow_mode_seconds)
        changed_fields.append("slow_mode_seconds")

    if join_approval_required is not None:
        room.join_approval_required = join_approval_required
        changed_fields.append("join_approval_required")

    if room.is_public and not room.username:
        raise GroupError("Public groups must have a username")

    if changed_fields:
        try:
            with transaction.atomic():
                room.save(update_fields=changed_fields)
        except IntegrityError as exc:
            if "username" in str(exc).lower():
                raise GroupConflictError("This username is already taken") from exc
            raise

        audit_security_event(
            "group.updated",
            actor_user=actor,
            actor_user_id=getattr(actor, "pk", None),
            actor_username=getattr(actor, "username", None),
            is_authenticated=True,
            room_slug=room.slug,
            changed_fields=changed_fields,
        )
    return room


def delete_group(actor, room_slug: str) -> None:
    """Delete a group. Only the owner (ADMINISTRATOR) can delete."""
    _ensure_authenticated(actor)
    room = _load_group_or_raise(room_slug)
    _ensure_group_permission(room, actor, Perm.ADMINISTRATOR)

    slug = room.slug
    room_name = room.name
    with transaction.atomic():
        room.delete()

    audit_security_event(
        "group.deleted",
        actor_user=actor,
        actor_user_id=getattr(actor, "pk", None),
        actor_username=getattr(actor, "username", None),
        is_authenticated=True,
        room_slug=slug,
        group_name=room_name,
    )


def get_group_info(room_slug: str, actor=None) -> dict:
    """Get group info. Public groups are visible to all; private require membership."""
    room = _load_group_or_raise(room_slug)

    if not room.is_public:
        if not actor or not getattr(actor, "is_authenticated", False):
            raise GroupNotFoundError("Group not found")
        if not has_permission(room, actor, Perm.READ_MESSAGES):
            raise GroupNotFoundError("Group not found")

    return {
        "slug": room.slug,
        "name": room.name,
        "description": room.description,
        "isPublic": room.is_public,
        "username": room.username,
        "memberCount": room.member_count,
        "slowModeSeconds": room.slow_mode_seconds,
        "joinApprovalRequired": room.join_approval_required,
        "createdBy": room.created_by.username if room.created_by else None,
        "avatarUrl": room.avatar.url if room.avatar else None,
    }


def list_public_groups(*, search: str | None = None, page: int = 1, page_size: int = 20) -> dict:
    """List discoverable public groups with optional search."""
    qs = Room.objects.filter(kind=Room.Kind.GROUP, is_public=True).order_by("-member_count", "name")

    if search:
        search = search.strip()
        if search.startswith("@"):
            qs = qs.filter(username__icontains=search[1:])
        else:
            qs = qs.filter(Q(name__icontains=search) | Q(username__icontains=search))

    total = qs.count()
    offset = (max(1, page) - 1) * page_size
    items = list(qs[offset : offset + page_size])

    return {
        "items": [
            {
                "slug": r.slug,
                "name": r.name,
                "description": r.description[:200],
                "username": r.username,
                "memberCount": r.member_count,
            }
            for r in items
        ],
        "total": total,
        "page": page,
        "pageSize": page_size,
    }
