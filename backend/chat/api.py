"""API endpoints for the chat subsystem."""

import re

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import IntegrityError, OperationalError, ProgrammingError, transaction
from django.http import Http404
from rest_framework import serializers, status as http_status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from messages.models import Message
from messages.serializers import MessageSerializer
from roles.access import ensure_can_read_or_404
from roles.models import Membership
from rooms.models import Room
from rooms.serializers import RoomPublicSerializer
from rooms.services import (
    direct_pair_key,
    direct_peer_for_user,
    direct_room_slug,
    ensure_direct_roles,
    ensure_direct_room_with_retry,
    ensure_role,
    ensure_room_owner_role,
    parse_pair_key_users,
)

from .constants import PUBLIC_ROOM_NAME, PUBLIC_ROOM_SLUG
from chat_app_django.media_utils import build_profile_url_from_request, serialize_avatar_crop

User = get_user_model()


class DirectStartInputSerializer(serializers.Serializer):
    username = serializers.CharField()


def _build_profile_pic_url(request, profile_pic):
    if not profile_pic:
        return None
    try:
        raw_value = profile_pic.url
    except (AttributeError, ValueError):
        raw_value = str(profile_pic)
    return build_profile_url_from_request(request, raw_value)


def _serialize_peer(request, user):
    profile_pic = None
    profile = getattr(user, "profile", None)
    image = getattr(profile, "image", None) if profile else None
    if image:
        profile_pic = _build_profile_pic_url(request, image)

    profile = getattr(user, "profile", None)
    last_seen = getattr(profile, "last_seen", None)
    return {
        "username": user.username,
        "profileImage": profile_pic,
        "avatarCrop": serialize_avatar_crop(profile),
        "lastSeen": last_seen.isoformat() if last_seen else None,
    }


def _normalize_username(raw_username):
    if not isinstance(raw_username, str):
        return ""
    value = raw_username.strip()
    if value.startswith("@"):
        value = value[1:]
    return value.strip()


def _public_room():
    try:
        room, _created = Room.objects.get_or_create(
            slug=PUBLIC_ROOM_SLUG,
            defaults={"name": PUBLIC_ROOM_NAME, "kind": Room.Kind.PUBLIC},
        )
        changed_fields = []
        if room.kind != Room.Kind.PUBLIC:
            room.kind = Room.Kind.PUBLIC
            changed_fields.append("kind")
        if room.direct_pair_key:
            room.direct_pair_key = None
            changed_fields.append("direct_pair_key")
        if changed_fields:
            room.save(update_fields=changed_fields)
        return room
    except (OperationalError, ProgrammingError, IntegrityError):
        return Room(slug=PUBLIC_ROOM_SLUG, name=PUBLIC_ROOM_NAME, kind=Room.Kind.PUBLIC)


def _is_valid_room_slug(slug: str) -> bool:
    pattern = getattr(settings, "CHAT_ROOM_SLUG_REGEX", r"^[A-Za-z0-9_-]{3,50}$")
    try:
        return bool(re.match(pattern, slug or ""))
    except re.error:
        return False


def _parse_positive_int(raw_value: str | None, param_name: str) -> int:
    try:
        parsed = int(raw_value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        raise ValueError(f"Invalid '{param_name}': must be an integer")
    if parsed < 1:
        raise ValueError(f"Invalid '{param_name}': must be >= 1")
    return parsed


def _resolve_room(room_slug: str):
    if room_slug == PUBLIC_ROOM_SLUG:
        return _public_room(), None

    if not _is_valid_room_slug(room_slug):
        return None, Response({"error": "Invalid room slug"}, status=http_status.HTTP_400_BAD_REQUEST)

    room = Room.objects.filter(slug=room_slug).first()
    return room, None


def _serialize_room_details(request, room: Room, created: bool):
    payload = {
        "slug": room.slug,
        "name": room.name,
        "kind": room.kind,
        "created": created,
        "createdBy": room.created_by.username if room.created_by else None,
        "peer": None,
    }

    if room.kind == Room.Kind.DIRECT and request.user and request.user.is_authenticated:
        peer = direct_peer_for_user(room, request.user)
        if peer:
            payload["peer"] = _serialize_peer(request, peer)

    return payload


@api_view(["GET"])
@permission_classes([AllowAny])
def public_room(request):
    room = _public_room()
    serializer = RoomPublicSerializer({"slug": room.slug, "name": room.name, "kind": room.kind})
    return Response(serializer.data)


class DirectStartApiView(GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = DirectStartInputSerializer

    def get(self, _request):
        return Response({"detail": "Use POST with username"})

    def post(self, request):
        target_username = _normalize_username(request.data.get("username"))
        if not target_username:
            return Response({"error": "username is required"}, status=http_status.HTTP_400_BAD_REQUEST)

        target = User.objects.filter(username=target_username).select_related("profile").first()
        if not target:
            return Response({"error": "Not found"}, status=http_status.HTTP_404_NOT_FOUND)

        if target.pk == request.user.pk:
            return Response({"error": "Cannot start direct chat with yourself"}, status=http_status.HTTP_400_BAD_REQUEST)

        pair_key = direct_pair_key(request.user.pk, target.pk)
        slug = direct_room_slug(pair_key)

        try:
            room, created = ensure_direct_room_with_retry(request.user, target, pair_key, slug)
        except OperationalError:
            return Response({"error": "Service unavailable"}, status=http_status.HTTP_503_SERVICE_UNAVAILABLE)

        try:
            with transaction.atomic():
                ensure_direct_roles(room, request.user, target, created=created)
        except OperationalError:
            return Response({"error": "Service unavailable"}, status=http_status.HTTP_503_SERVICE_UNAVAILABLE)

        return Response(
            {
                "slug": room.slug,
                "kind": room.kind,
                "peer": _serialize_peer(request, target),
            }
        )


direct_start = DirectStartApiView.as_view()


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def direct_chats(request):
    membership_qs = (
        Membership.objects.filter(
            user=request.user,
            room__kind=Room.Kind.DIRECT,
            is_banned=False,
        )
        .select_related("room")
        .order_by("-joined_at")
    )

    seen_room_ids: set[int] = set()
    items = []
    for membership in membership_qs:
        room = membership.room
        room_pk = getattr(room, "pk", None)
        if room_pk is None:
            continue
        if room_pk in seen_room_ids:
            continue
        seen_room_ids.add(room_pk)

        pair = parse_pair_key_users(room.direct_pair_key)
        if not pair or request.user.pk not in pair:
            continue

        last_message = Message.objects.filter(room=room).order_by("-date_added", "-id").first()

        peer = direct_peer_for_user(room, request.user)
        if not peer:
            continue

        sort_key = (
            last_message.date_added.timestamp()
            if last_message is not None
            else membership.joined_at.timestamp()
        )
        items.append(
            {
                "slug": room.slug,
                "peer": _serialize_peer(request, peer),
                "lastMessage": last_message.message_content if last_message else "",
                "lastMessageAt": last_message.date_added.isoformat() if last_message else None,
                "sortKey": sort_key,
            }
        )

    items.sort(key=lambda item: item["sortKey"], reverse=True)
    for item in items:
        item.pop("sortKey", None)

    return Response({"items": items})


@api_view(["GET"])
@permission_classes([AllowAny])
def room_details(request, room_slug):
    try:
        room, error_response = _resolve_room(room_slug)
        if error_response:
            return error_response

        created = False
        if room is None:
            if not request.user or not request.user.is_authenticated:
                return Response({"error": "Not found"}, status=http_status.HTTP_404_NOT_FOUND)

            room = Room.objects.create(
                slug=room_slug,
                name=request.user.username,
                kind=Room.Kind.PRIVATE,
                created_by=request.user,
            )
            ensure_role(room, request.user, "Owner", granted_by=request.user)
            created = True
        else:
            if room.kind in {Room.Kind.PRIVATE, Room.Kind.DIRECT, Room.Kind.GROUP}:
                try:
                    ensure_can_read_or_404(room, request.user)
                except Http404:
                    if room.kind not in {Room.Kind.GROUP}:
                        ensure_room_owner_role(room)
                        try:
                            ensure_can_read_or_404(room, request.user)
                        except Http404:
                            return Response({"error": "Not found"}, status=http_status.HTTP_404_NOT_FOUND)
                    else:
                        return Response({"error": "Not found"}, status=http_status.HTTP_404_NOT_FOUND)

        return Response(_serialize_room_details(request, room, created=created))
    except (OperationalError, ProgrammingError, IntegrityError):
        return Response(
            {
                "slug": room_slug,
                "name": room_slug,
                "kind": Room.Kind.PRIVATE,
                "created": True,
                "createdBy": None,
                "peer": None,
            }
        )


@api_view(["GET"])
@permission_classes([AllowAny])
def room_messages(request, room_slug):
    room, error_response = _resolve_room(room_slug)
    if error_response:
        return error_response

    if room is None:
        return Response({"error": "Not found"}, status=http_status.HTTP_404_NOT_FOUND)

    if room.kind in {Room.Kind.PRIVATE, Room.Kind.DIRECT, Room.Kind.GROUP}:
        try:
            ensure_can_read_or_404(room, request.user)
        except Http404:
            return Response({"error": "Not found"}, status=http_status.HTTP_404_NOT_FOUND)

    try:
        default_page_size = max(1, int(getattr(settings, "CHAT_MESSAGES_PAGE_SIZE", 50)))
        max_page_size = max(
            default_page_size,
            int(getattr(settings, "CHAT_MESSAGES_MAX_PAGE_SIZE", 200)),
        )

        limit_raw = request.query_params.get("limit")
        before_raw = request.query_params.get("before")

        if limit_raw is None:
            limit = default_page_size
        else:
            try:
                limit = _parse_positive_int(limit_raw, "limit")
            except ValueError as exc:
                return Response({"error": str(exc)}, status=http_status.HTTP_400_BAD_REQUEST)
        limit = min(limit, max_page_size)

        before_id = None
        if before_raw is not None:
            try:
                before_id = _parse_positive_int(before_raw, "before")
            except ValueError as exc:
                return Response({"error": str(exc)}, status=http_status.HTTP_400_BAD_REQUEST)

        messages_qs = Message.objects.filter(room=room).select_related("user", "user__profile")
        if before_id is not None:
            messages_qs = messages_qs.filter(id__lt=before_id)

        batch = list(messages_qs.order_by("-id")[: limit + 1])
        has_more = len(batch) > limit
        if has_more:
            batch = batch[:limit]
        batch.reverse()

        next_before = getattr(batch[0], "pk", None) if has_more and batch else None

        serializer = MessageSerializer(
            batch,
            many=True,
            context={
                "request": request,
                "build_profile_pic_url": lambda pic: _build_profile_pic_url(request, pic),
                "serialize_avatar_crop": serialize_avatar_crop,
            },
        )

        return Response(
            {
                "messages": serializer.data,
                "pagination": {
                    "limit": limit,
                    "hasMore": has_more,
                    "nextBefore": next_before,
                },
            }
        )
    except (OperationalError, ProgrammingError):
        return Response(
            {
                "messages": [],
                "pagination": {
                    "limit": int(getattr(settings, "CHAT_MESSAGES_PAGE_SIZE", 50)),
                    "hasMore": False,
                    "nextBefore": None,
                },
            }
        )
