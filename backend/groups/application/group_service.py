"""Group CRUD operations."""

from __future__ import annotations

from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import Q

from chat_app_django.media_utils import build_profile_url_from_request, serialize_avatar_crop
from chat_app_django.security.audit import audit_security_event
from groups.domain import rules as group_rules
from roles.application.permission_service import compute_permissions, has_permission
from roles.models import Membership, Role
from roles.permissions import Perm
from rooms.models import Room


class _UnsetType:
    __slots__ = ()


_UNSET = _UnsetType()
_ROOM_AVATAR_CROP_FIELDS = (
    "avatar_crop_x",
    "avatar_crop_y",
    "avatar_crop_width",
    "avatar_crop_height",
)
_DEFAULT_GROUP_AVATAR = str(getattr(settings, "GROUP_DEFAULT_AVATAR", "default.jpg"))


class GroupError(Exception):
    pass


class GroupNotFoundError(GroupError):
    pass


class GroupForbiddenError(GroupError):
    pass


class GroupConflictError(GroupError):
    pass


_GROUP_USERNAME_CONFLICT_MSG = "Это имя пользователя уже занято"


def _append_changed(changed_fields: list[str], field_name: str) -> None:
    if field_name not in changed_fields:
        changed_fields.append(field_name)


def _clear_room_avatar_crop(room: Room, changed_fields: list[str]) -> None:
    room.avatar_crop_x = None
    room.avatar_crop_y = None
    room.avatar_crop_width = None
    room.avatar_crop_height = None
    for field in _ROOM_AVATAR_CROP_FIELDS:
        _append_changed(changed_fields, field)


def _apply_room_avatar_crop(room: Room, crop_payload: dict[str, float], changed_fields: list[str]) -> None:
    room.avatar_crop_x = crop_payload["avatar_crop_x"]
    room.avatar_crop_y = crop_payload["avatar_crop_y"]
    room.avatar_crop_width = crop_payload["avatar_crop_width"]
    room.avatar_crop_height = crop_payload["avatar_crop_height"]
    for field in _ROOM_AVATAR_CROP_FIELDS:
        _append_changed(changed_fields, field)


def _validate_room_avatar_crop(crop_payload: dict[str, float]) -> dict[str, float]:
    for key in _ROOM_AVATAR_CROP_FIELDS:
        if crop_payload.get(key) is None:
            raise GroupError("Укажите все поля обрезки аватарки")

    try:
        x = float(crop_payload["avatar_crop_x"])
        y = float(crop_payload["avatar_crop_y"])
        width = float(crop_payload["avatar_crop_width"])
        height = float(crop_payload["avatar_crop_height"])
    except (KeyError, TypeError, ValueError):
        raise GroupError("Некорректные данные обрезки аватарки")

    if not (0 <= x < 1 and 0 <= y < 1 and 0 < width <= 1 and 0 < height <= 1):
        raise GroupError("Значения обрезки аватарки должны быть в диапазоне [0..1]")
    if (x + width) > 1.000001 or (y + height) > 1.000001:
        raise GroupError("Значения обрезки аватарки выходят за границы изображения")

    return {
        "avatar_crop_x": x,
        "avatar_crop_y": y,
        "avatar_crop_width": width,
        "avatar_crop_height": height,
    }


def _serialize_group_avatar(request, room: Room) -> tuple[str | None, dict[str, float] | None]:
    avatar_url: str | None = None
    if room.avatar:
        image_name = getattr(room.avatar, "name", "")
        if image_name:
            if request is not None:
                avatar_url = build_profile_url_from_request(request, image_name)
            else:
                try:
                    avatar_url = room.avatar.url
                except (AttributeError, ValueError):
                    avatar_url = None
    elif _DEFAULT_GROUP_AVATAR:
        if request is not None:
            avatar_url = build_profile_url_from_request(request, _DEFAULT_GROUP_AVATAR)
        else:
            media_url = str(getattr(settings, "MEDIA_URL", "/media/") or "/media/")
            avatar_url = f"{media_url.rstrip('/')}/{_DEFAULT_GROUP_AVATAR.lstrip('/')}"
    return avatar_url, serialize_avatar_crop(room)


def _ensure_authenticated(actor) -> None:
    if not actor or not getattr(actor, "is_authenticated", False):
        raise GroupForbiddenError("Требуется аутентификация")


def _load_group_or_raise(room_slug: str) -> Room:
    room = Room.objects.filter(slug=room_slug, kind=Room.Kind.GROUP).first()
    if not room:
        raise GroupNotFoundError("Группа не найдена")
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
        raise GroupForbiddenError(f"Отсутствует разрешение {perm.name}")


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

    if username and Room.objects.filter(username=username).exists():
        raise GroupConflictError(_GROUP_USERNAME_CONFLICT_MSG)

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
            owner_role = roles.get(Role.OWNER)
            if owner_role:
                membership.roles.add(owner_role)
    except IntegrityError as exc:
        if username and Room.objects.filter(username=username).exists():
            raise GroupConflictError(_GROUP_USERNAME_CONFLICT_MSG) from exc
        raise GroupConflictError("Не удалось создать группу") from exc

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
    username: str | None | _UnsetType = _UNSET,
    slow_mode_seconds: int | None = None,
    join_approval_required: bool | None = None,
    avatar=None,
    avatar_action: str | None = None,
    avatar_crop: dict[str, float] | _UnsetType = _UNSET,
) -> Room:
    """Update group settings. Requires CHANGE_GROUP_INFO or MANAGE_ROOM."""
    _ensure_authenticated(actor)
    room = _load_group_or_raise(room_slug)

    effective = compute_permissions(room, actor)
    if not (effective & (Perm.CHANGE_GROUP_INFO | Perm.MANAGE_ROOM | Perm.ADMINISTRATOR)):
        raise GroupForbiddenError("Отсутствует разрешение на редактирование информации о группе")

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

    if not isinstance(username, _UnsetType):
        room.username = group_rules.validate_group_username(username)
        changed_fields.append("username")

    if slow_mode_seconds is not None:
        room.slow_mode_seconds = group_rules.validate_slow_mode(slow_mode_seconds)
        changed_fields.append("slow_mode_seconds")

    if join_approval_required is not None:
        room.join_approval_required = join_approval_required
        changed_fields.append("join_approval_required")

    if avatar is not None and avatar_action == "remove":
        raise GroupError("Нельзя одновременно загрузить и удалить аватарку в одном запросе")

    crop_update: dict[str, float] | None | _UnsetType = _UNSET
    if not isinstance(avatar_crop, _UnsetType):
        crop_update = _validate_room_avatar_crop(avatar_crop)

    if avatar is not None:
        room.avatar = avatar
        _append_changed(changed_fields, "avatar")
        # New avatar upload without explicit crop resets previous crop metadata.
        if isinstance(crop_update, _UnsetType):
            crop_update = None
    elif avatar_action == "remove":
        if room.avatar:
            room.avatar.delete(save=False)
        setattr(room, "avatar", None)
        _append_changed(changed_fields, "avatar")
        crop_update = None

    if crop_update is None:
        _clear_room_avatar_crop(room, changed_fields)
    elif not isinstance(crop_update, _UnsetType):
        _apply_room_avatar_crop(room, crop_update, changed_fields)

    if "username" in changed_fields and room.username:
        conflict = Room.objects.filter(username=room.username).exclude(pk=room.pk).exists()
        if conflict:
            raise GroupConflictError(_GROUP_USERNAME_CONFLICT_MSG)

    if changed_fields:
        try:
            with transaction.atomic():
                room.save(update_fields=changed_fields)
        except IntegrityError as exc:
            if room.username and Room.objects.filter(username=room.username).exclude(pk=room.pk).exists():
                raise GroupConflictError(_GROUP_USERNAME_CONFLICT_MSG) from exc
            raise GroupConflictError("Не удалось обновить группу") from exc

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


def get_group_info(room_slug: str, actor=None, request=None) -> dict:
    """Get group info. Public groups are visible to all; private require membership."""
    room = _load_group_or_raise(room_slug)

    if not room.is_public:
        if not actor or not getattr(actor, "is_authenticated", False):
            raise GroupNotFoundError("Группа не найдена")
        if not has_permission(room, actor, Perm.READ_MESSAGES):
            raise GroupNotFoundError("Группа не найдена")

    avatar_url, avatar_crop = _serialize_group_avatar(request, room)

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
        "avatarUrl": avatar_url,
        "avatarCrop": avatar_crop,
    }


def list_public_groups(*, search: str | None = None, page: int = 1, page_size: int = 20, request=None) -> dict:
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

    payload_items = []
    for room in items:
        avatar_url, avatar_crop = _serialize_group_avatar(request, room)
        payload_items.append(
            {
                "slug": room.slug,
                "name": room.name,
                "description": room.description[:200],
                "username": room.username,
                "memberCount": room.member_count,
                "avatarUrl": avatar_url,
                "avatarCrop": avatar_crop,
            }
        )

    return {
        "items": payload_items,
        "total": total,
        "page": page,
        "pageSize": page_size,
    }


def list_my_groups(actor, *, search: str | None = None, page: int = 1, page_size: int = 20, request=None) -> dict:
    """List groups where the actor has an active membership."""
    _ensure_authenticated(actor)

    qs = (
        Room.objects.filter(
            kind=Room.Kind.GROUP,
            memberships__user=actor,
            memberships__is_banned=False,
        )
        .distinct()
        .order_by("-member_count", "name")
    )

    if search:
        search = search.strip()
        if search.startswith("@"):
            qs = qs.filter(username__icontains=search[1:])
        else:
            qs = qs.filter(Q(name__icontains=search) | Q(username__icontains=search))

    total = qs.count()
    offset = (max(1, page) - 1) * page_size
    items = list(qs[offset : offset + page_size])

    payload_items = []
    for room in items:
        avatar_url, avatar_crop = _serialize_group_avatar(request, room)
        payload_items.append(
            {
                "slug": room.slug,
                "name": room.name,
                "description": room.description[:200],
                "username": room.username,
                "memberCount": room.member_count,
                "avatarUrl": avatar_url,
                "avatarCrop": avatar_crop,
            }
        )

    return {
        "items": payload_items,
        "total": total,
        "page": page,
        "pageSize": page_size,
    }
