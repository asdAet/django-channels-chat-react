"""Group CRUD operations."""

from __future__ import annotations

from django.conf import settings
from django.db import transaction

from chat_app_django.media_utils import build_profile_url_from_request, serialize_avatar_crop
from chat_app_django.security.audit import audit_security_event
from groups.domain import rules as group_rules
from roles.application.permission_service import compute_permissions, has_permission
from roles.models import Membership, Role
from roles.permissions import Perm
from rooms.models import Room
from users.identity import (
    ensure_group_public_id,
    room_public_handle,
    room_public_id,
    room_public_ref,
    set_room_public_handle,
    user_public_username,
)
from users.models import PublicHandle


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


_GROUP_USERNAME_CONFLICT_MSG = "Этот username уже занят"


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


def _load_group_or_raise(room_id: int) -> Room:
    room = Room.objects.filter(pk=int(room_id), kind=Room.Kind.GROUP).first()
    if not room:
        raise GroupNotFoundError("Группа не найдена")
    return room


def _ensure_group_permission(room: Room, actor, perm: Perm) -> None:
    if not has_permission(room, actor, perm):
        audit_security_event(
            "group.permission.denied",
            actor_user=actor,
            actor_user_id=getattr(actor, "pk", None),
            actor_username=user_public_username(actor),
            is_authenticated=True,
            room_id=room.pk,
            required_permission=perm.name,
        )
        raise GroupForbiddenError(f"Отсутствует разрешение {perm.name}")


def _normalize_group_handle(username: str | None) -> str | None:
    if username is None:
        return None
    value = str(username).strip()
    if not value:
        return None
    return group_rules.validate_group_username(value)


def create_group(
    actor,
    *,
    name: str,
    description: str = "",
    is_public: bool = False,
    username: str | None = None,
) -> Room:
    _ensure_authenticated(actor)

    name = group_rules.validate_group_name(name)
    description = group_rules.validate_group_description(description)
    normalized_handle = _normalize_group_handle(username)

    if normalized_handle and PublicHandle.objects.filter(handle=normalized_handle).exists():
        raise GroupConflictError(_GROUP_USERNAME_CONFLICT_MSG)

    if is_public and not normalized_handle:
        raise GroupError("Для публичной группы требуется username")

    slug = group_rules.generate_group_slug(name)

    with transaction.atomic():
        room = Room.objects.create(
            name=name,
            slug=slug,
            kind=Room.Kind.GROUP,
            description=description,
            is_public=is_public,
            created_by=actor,
            member_count=1,
        )
        ensure_group_public_id(room)

        if normalized_handle:
            try:
                set_room_public_handle(room, normalized_handle)
            except ValueError as exc:
                raise GroupConflictError(str(exc)) from exc

        roles = Role.create_defaults_for_room(room)
        membership = Membership.objects.create(room=room, user=actor)
        owner_role = roles.get(Role.OWNER)
        if owner_role:
            membership.roles.add(owner_role)

    audit_security_event(
        "group.created",
        actor_user=actor,
        actor_user_id=getattr(actor, "pk", None),
        actor_username=user_public_username(actor),
        is_authenticated=True,
        room_id=room.pk,
        group_name=name,
        is_public=is_public,
    )
    return room


def update_group(
    actor,
    room_id: int,
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
    _ensure_authenticated(actor)
    room = _load_group_or_raise(room_id)

    effective = compute_permissions(room, actor)
    if not (effective & (Perm.CHANGE_GROUP_INFO | Perm.MANAGE_ROOM | Perm.ADMINISTRATOR)):
        raise GroupForbiddenError("Отсутствует разрешение на редактирование информации о группе")

    changed_fields: list[str] = []
    current_handle = room_public_handle(room)

    if name is not None:
        room.name = group_rules.validate_group_name(name)
        changed_fields.append("name")

    if description is not None:
        room.description = group_rules.validate_group_description(description)
        changed_fields.append("description")

    if is_public is not None:
        room.is_public = is_public
        changed_fields.append("is_public")

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

    requested_handle: str | None | _UnsetType = _UNSET
    if not isinstance(username, _UnsetType):
        requested_handle = _normalize_group_handle(username)

    target_handle = current_handle if isinstance(requested_handle, _UnsetType) else requested_handle
    if room.is_public and not target_handle:
        raise GroupError("Для публичной группы требуется username")

    with transaction.atomic():
        if changed_fields:
            room.save(update_fields=changed_fields)

        if not isinstance(requested_handle, _UnsetType):
            try:
                set_room_public_handle(room, requested_handle)
            except ValueError as exc:
                raise GroupConflictError(str(exc)) from exc

        if room.is_public and not room_public_handle(room):
            raise GroupError("Для публичной группы требуется username")

    if changed_fields or not isinstance(requested_handle, _UnsetType):
        audit_security_event(
            "group.updated",
            actor_user=actor,
            actor_user_id=getattr(actor, "pk", None),
            actor_username=user_public_username(actor),
            is_authenticated=True,
            room_id=room.pk,
            changed_fields=changed_fields,
        )
    return room


def delete_group(actor, room_id: int) -> None:
    _ensure_authenticated(actor)
    room = _load_group_or_raise(room_id)
    _ensure_group_permission(room, actor, Perm.ADMINISTRATOR)

    room_name = room.name
    room_id = room.pk
    with transaction.atomic():
        room.delete()

    audit_security_event(
        "group.deleted",
        actor_user=actor,
        actor_user_id=getattr(actor, "pk", None),
        actor_username=user_public_username(actor),
        is_authenticated=True,
        room_id=room_id,
        group_name=room_name,
    )


def get_group_info(room_id: int, actor=None, request=None) -> dict:
    room = _load_group_or_raise(room_id)
    handle = room_public_handle(room)
    public_access = bool(room.is_public and handle)

    if not public_access:
        if not actor or not getattr(actor, "is_authenticated", False):
            raise GroupNotFoundError("Группа не найдена")
        if not has_permission(room, actor, Perm.READ_MESSAGES):
            raise GroupNotFoundError("Группа не найдена")

    ensure_group_public_id(room)
    avatar_url, avatar_crop = _serialize_group_avatar(request, room)

    return {
        "roomId": room.pk,
        "name": room.name,
        "description": room.description,
        "isPublic": public_access,
        "username": handle,
        "publicId": room_public_id(room),
        "publicRef": room_public_ref(room),
        "memberCount": room.member_count,
        "slowModeSeconds": room.slow_mode_seconds,
        "joinApprovalRequired": room.join_approval_required,
        "createdBy": user_public_username(room.created_by) if room.created_by else None,
        "avatarUrl": avatar_url,
        "avatarCrop": avatar_crop,
    }


def _room_matches_handle(room: Room, search: str) -> bool:
    handle = room_public_handle(room)
    if not handle:
        return False
    return search in handle


def list_public_groups(
    *,
    search: str | None = None,
    before_id: int | None = None,
    limit: int = 20,
    request=None,
) -> dict:
    limit = max(1, min(int(limit), 100))
    qs = Room.objects.filter(
        kind=Room.Kind.GROUP,
        is_public=True,
        public_handle__isnull=False,
    )

    if search:
        value = search.strip().lower()
        if value.startswith("@"):
            value = value[1:]
        if value:
            qs = qs.filter(public_handle__handle__icontains=value)

    total = qs.count()
    if before_id is not None:
        qs = qs.filter(id__lt=int(before_id))

    batch = list(qs.order_by("-id")[: limit + 1])
    has_more = len(batch) > limit
    if has_more:
        batch = batch[:limit]
    next_before = int(batch[-1].pk) if has_more and batch else None

    payload_items = []
    for room in batch:
        ensure_group_public_id(room)
        avatar_url, avatar_crop = _serialize_group_avatar(request, room)
        payload_items.append(
            {
                "roomId": room.pk,
                "name": room.name,
                "description": room.description[:200],
                "username": room_public_handle(room),
                "publicId": room_public_id(room),
                "publicRef": room_public_ref(room),
                "memberCount": room.member_count,
                "avatarUrl": avatar_url,
                "avatarCrop": avatar_crop,
            }
        )

    return {
        "items": payload_items,
        "total": total,
        "pagination": {
            "limit": limit,
            "hasMore": has_more,
            "nextBefore": next_before,
        },
    }


def list_my_groups(
    actor,
    *,
    search: str | None = None,
    before_id: int | None = None,
    limit: int = 20,
    request=None,
) -> dict:
    _ensure_authenticated(actor)
    limit = max(1, min(int(limit), 100))

    qs = (
        Room.objects.filter(
            kind=Room.Kind.GROUP,
            memberships__user=actor,
            memberships__is_banned=False,
        )
        .distinct()
    )

    if search:
        value = search.strip().lower()
        if value.startswith("@"):
            value = value[1:]
        if value:
            qs = qs.filter(public_handle__handle__icontains=value)

    total = qs.count()
    if before_id is not None:
        qs = qs.filter(id__lt=int(before_id))

    batch = list(qs.order_by("-id")[: limit + 1])
    has_more = len(batch) > limit
    if has_more:
        batch = batch[:limit]
    next_before = int(batch[-1].pk) if has_more and batch else None

    payload_items = []
    for room in batch:
        ensure_group_public_id(room)
        avatar_url, avatar_crop = _serialize_group_avatar(request, room)
        payload_items.append(
            {
                "roomId": room.pk,
                "name": room.name,
                "description": room.description[:200],
                "username": room_public_handle(room),
                "publicId": room_public_id(room),
                "publicRef": room_public_ref(room),
                "memberCount": room.member_count,
                "avatarUrl": avatar_url,
                "avatarCrop": avatar_crop,
            }
        )

    return {
        "items": payload_items,
        "total": total,
        "pagination": {
            "limit": limit,
            "hasMore": has_more,
            "nextBefore": next_before,
        },
    }

