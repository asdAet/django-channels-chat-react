"""API endpoints for the chat subsystem."""

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import IntegrityError, OperationalError, ProgrammingError, transaction
from django.http import Http404
from rest_framework import serializers, status as http_status
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.generics import GenericAPIView
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from messages.models import Message, MessageAttachment
from messages.serializers import MessageSerializer
from roles.access import ensure_can_read_or_404, has_permission
from roles.models import Membership
from roles.permissions import Perm
from rooms.models import Room
from rooms.serializers import RoomPublicSerializer

from .services import (
    MessageForbiddenError,
    MessageNotFoundError,
    MessageValidationError,
    add_reaction,
    delete_message,
    edit_message,
    get_unread_counts,
    mark_read as service_mark_read,
    remove_reaction,
)
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


from chat.utils import is_valid_room_slug as _is_valid_room_slug


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

        messages_qs = (
            Message.objects.filter(room=room)
            .select_related("user", "user__profile", "reply_to", "reply_to__user")
            .prefetch_related("attachments", "reactions")
        )
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


# ── Helpers for WS broadcast from REST views ──────────────────────────

def _broadcast_to_room(room: Room, event: dict):
    """Send a channel-layer event to the room group."""
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return
    room_identifier = room.pk if getattr(room, "pk", None) else room.slug
    group_name = f"chat_room_{room_identifier}"
    async_to_sync(channel_layer.group_send)(group_name, event)


def _ensure_room_read_access(request, room: Room):
    """Raise Http404 if user cannot read this room."""
    if room.kind in {Room.Kind.PRIVATE, Room.Kind.DIRECT, Room.Kind.GROUP}:
        ensure_can_read_or_404(room, request.user)


# ── Message Edit / Delete ─────────────────────────────────────────────

@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def message_detail(request, room_slug, message_id):
    room, error_response = _resolve_room(room_slug)
    if error_response:
        return error_response
    if room is None:
        return Response({"error": "Not found"}, status=http_status.HTTP_404_NOT_FOUND)

    try:
        _ensure_room_read_access(request, room)
    except Http404:
        return Response({"error": "Not found"}, status=http_status.HTTP_404_NOT_FOUND)

    try:
        if request.method == "PATCH":
            content = request.data.get("content", "")
            if not isinstance(content, str):
                return Response({"error": "content is required"}, status=http_status.HTTP_400_BAD_REQUEST)
            msg = edit_message(request.user, room, message_id, content)
            edited_at = msg.edited_at or msg.date_added
            _broadcast_to_room(room, {
                "type": "chat_message_edit",
                "messageId": msg.pk,
                "content": msg.message_content,
                "editedAt": edited_at.isoformat(),
                "editedBy": request.user.username,
            })
            return Response({
                "id": msg.pk,
                "content": msg.message_content,
                "editedAt": edited_at.isoformat(),
            })
        else:
            msg = delete_message(request.user, room, message_id)
            _broadcast_to_room(room, {
                "type": "chat_message_delete",
                "messageId": msg.pk,
                "deletedBy": request.user.username,
            })
            return Response(status=http_status.HTTP_204_NO_CONTENT)

    except MessageNotFoundError:
        return Response({"error": "Message not found"}, status=http_status.HTTP_404_NOT_FOUND)
    except MessageForbiddenError as exc:
        return Response({"error": str(exc)}, status=http_status.HTTP_403_FORBIDDEN)
    except MessageValidationError as exc:
        return Response({"error": str(exc)}, status=http_status.HTTP_400_BAD_REQUEST)


# ── Reactions ─────────────────────────────────────────────────────────

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def message_reactions(request, room_slug, message_id):
    room, error_response = _resolve_room(room_slug)
    if error_response:
        return error_response
    if room is None:
        return Response({"error": "Not found"}, status=http_status.HTTP_404_NOT_FOUND)

    try:
        _ensure_room_read_access(request, room)
    except Http404:
        return Response({"error": "Not found"}, status=http_status.HTTP_404_NOT_FOUND)

    emoji = request.data.get("emoji", "")
    if not isinstance(emoji, str):
        return Response({"error": "emoji is required"}, status=http_status.HTTP_400_BAD_REQUEST)

    try:
        reaction = add_reaction(request.user, room, message_id, emoji)
        _broadcast_to_room(room, {
            "type": "chat_reaction_add",
            "messageId": message_id,
            "emoji": reaction.emoji,
            "userId": request.user.pk,
            "username": request.user.username,
        })
        return Response({
            "messageId": message_id,
            "emoji": reaction.emoji,
            "userId": request.user.pk,
            "username": request.user.username,
        })
    except MessageNotFoundError:
        return Response({"error": "Message not found"}, status=http_status.HTTP_404_NOT_FOUND)
    except MessageForbiddenError as exc:
        return Response({"error": str(exc)}, status=http_status.HTTP_403_FORBIDDEN)
    except MessageValidationError as exc:
        return Response({"error": str(exc)}, status=http_status.HTTP_400_BAD_REQUEST)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def message_reaction_remove(request, room_slug, message_id, emoji):
    room, error_response = _resolve_room(room_slug)
    if error_response:
        return error_response
    if room is None:
        return Response({"error": "Not found"}, status=http_status.HTTP_404_NOT_FOUND)

    try:
        _ensure_room_read_access(request, room)
    except Http404:
        return Response({"error": "Not found"}, status=http_status.HTTP_404_NOT_FOUND)

    remove_reaction(request.user, room, message_id, emoji)
    _broadcast_to_room(room, {
        "type": "chat_reaction_remove",
        "messageId": message_id,
        "emoji": emoji,
        "userId": request.user.pk,
        "username": request.user.username,
    })
    return Response(status=http_status.HTTP_204_NO_CONTENT)


# ── File Attachments ──────────────────────────────────────────────────

@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser])
def upload_attachments(request, room_slug):
    room, error_response = _resolve_room(room_slug)
    if error_response:
        return error_response
    if room is None:
        return Response({"error": "Not found"}, status=http_status.HTTP_404_NOT_FOUND)

    try:
        _ensure_room_read_access(request, room)
    except Http404:
        return Response({"error": "Not found"}, status=http_status.HTTP_404_NOT_FOUND)

    if not has_permission(room, request.user, Perm.ATTACH_FILES):
        return Response({"error": "Missing ATTACH_FILES permission"}, status=http_status.HTTP_403_FORBIDDEN)

    files = request.FILES.getlist("files")
    if not files:
        return Response({"error": "No files provided"}, status=http_status.HTTP_400_BAD_REQUEST)

    max_per_msg = int(getattr(settings, "CHAT_ATTACHMENT_MAX_PER_MESSAGE", 5))
    if len(files) > max_per_msg:
        return Response(
            {"error": f"Maximum {max_per_msg} files per message"},
            status=http_status.HTTP_400_BAD_REQUEST,
        )

    max_size = int(getattr(settings, "CHAT_ATTACHMENT_MAX_SIZE_MB", 10)) * 1024 * 1024
    allowed_types = getattr(settings, "CHAT_ATTACHMENT_ALLOWED_TYPES", [
        "image/jpeg", "image/png", "image/gif", "image/webp",
        "application/pdf", "text/plain", "video/mp4", "audio/mpeg", "audio/webm",
    ])

    for f in files:
        if f.size > max_size:
            return Response(
                {"error": f"File '{f.name}' exceeds maximum size"},
                status=http_status.HTTP_400_BAD_REQUEST,
            )
        if f.content_type not in allowed_types:
            return Response(
                {"error": f"File type '{f.content_type}' is not allowed"},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

    message_content = request.data.get("messageContent", "")
    if not isinstance(message_content, str):
        message_content = ""

    user = request.user
    profile = getattr(user, "profile", None)
    image = getattr(profile, "image", None) if profile else None
    profile_pic = getattr(image, "name", "") or ""

    msg = Message.objects.create(
        message_content=message_content,
        username=user.username,
        user=user,
        profile_pic=profile_pic,
        room=room,
    )

    from messages.thumbnail import generate_thumbnail

    attachments_data = []
    for f in files:
        attachment = MessageAttachment.objects.create(
            message=msg,
            file=f,
            original_filename=f.name or "file",
            content_type=f.content_type or "application/octet-stream",
            file_size=f.size,
        )

        if f.content_type and f.content_type.startswith("image/"):
            thumb_info = generate_thumbnail(attachment.file)
            if thumb_info:
                attachment.thumbnail = thumb_info["path"]
                attachment.width = thumb_info.get("width")
                attachment.height = thumb_info.get("height")
                attachment.save(update_fields=["thumbnail", "width", "height"])

        attachments_data.append({
            "id": attachment.pk,
            "originalFilename": attachment.original_filename,
            "contentType": attachment.content_type,
            "fileSize": attachment.file_size,
            "url": _build_profile_pic_url(request, attachment.file),
            "thumbnailUrl": _build_profile_pic_url(request, attachment.thumbnail) if attachment.thumbnail else None,
            "width": attachment.width,
            "height": attachment.height,
        })

    profile_url = _build_profile_pic_url(request, image) if image else None
    _broadcast_to_room(room, {
        "type": "chat_message",
        "message": message_content,
        "username": user.username,
        "profile_pic": profile_url,
        "avatar_crop": serialize_avatar_crop(profile),
        "room": room.slug,
        "id": msg.pk,
        "date_added": msg.date_added.isoformat(),
        "attachments": attachments_data,
    })

    return Response({
        "id": msg.pk,
        "content": message_content,
        "attachments": attachments_data,
    }, status=http_status.HTTP_201_CREATED)


# ── Message Search ────────────────────────────────────────────────────

@api_view(["GET"])
@permission_classes([AllowAny])
def search_messages(request, room_slug):
    room, error_response = _resolve_room(room_slug)
    if error_response:
        return error_response
    if room is None:
        return Response({"error": "Not found"}, status=http_status.HTTP_404_NOT_FOUND)

    try:
        _ensure_room_read_access(request, room)
    except Http404:
        return Response({"error": "Not found"}, status=http_status.HTTP_404_NOT_FOUND)

    q = request.query_params.get("q", "").strip()
    if len(q) < 2:
        return Response({"error": "Query must be at least 2 characters"}, status=http_status.HTTP_400_BAD_REQUEST)

    try:
        limit = min(int(request.query_params.get("limit", 20)), 50)
    except (TypeError, ValueError):
        limit = 20
    limit = max(1, limit)

    before_id = None
    before_raw = request.query_params.get("before")
    if before_raw:
        try:
            before_id = int(before_raw)
        except (TypeError, ValueError):
            pass

    from django.db import connection

    qs = Message.objects.filter(room=room, is_deleted=False)
    if before_id:
        qs = qs.filter(id__lt=before_id)

    if connection.vendor == "postgresql":
        from django.contrib.postgres import search as pg_search

        vector = pg_search.SearchVector("message_content", config="russian")
        query = pg_search.SearchQuery(q, config="russian", search_type="websearch")
        qs = (
            qs.annotate(search=vector, rank=pg_search.SearchRank(vector, query))
            .filter(search=query)
            .order_by("-rank", "-id")
        )
        search_headline = getattr(pg_search, "SearchHeadline", None)
        if search_headline is not None:
            qs = qs.annotate(
                headline=search_headline(
                    "message_content",
                    query,
                    start_sel="<mark>",
                    stop_sel="</mark>",
                    max_words=50,
                    min_words=20,
                )
            )
    else:
        qs = qs.filter(message_content__icontains=q).order_by("-id")

    batch = list(qs.select_related("user")[: limit + 1])
    has_more = len(batch) > limit
    if has_more:
        batch = batch[:limit]

    results = []
    for msg in batch:
        results.append({
            "id": msg.pk,
            "username": msg.user.username if msg.user else msg.username,
            "content": msg.message_content,
            "createdAt": msg.date_added.isoformat(),
            "highlight": getattr(msg, "headline", None),
        })

    return Response({
        "results": results,
        "pagination": {
            "limit": limit,
            "hasMore": has_more,
            "nextBefore": batch[-1].pk if has_more and batch else None,
        },
    })


# ── Read Receipts ─────────────────────────────────────────────────────

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_read_view(request, room_slug):
    room, error_response = _resolve_room(room_slug)
    if error_response:
        return error_response
    if room is None:
        return Response({"error": "Not found"}, status=http_status.HTTP_404_NOT_FOUND)

    try:
        _ensure_room_read_access(request, room)
    except Http404:
        return Response({"error": "Not found"}, status=http_status.HTTP_404_NOT_FOUND)

    last_read_id = request.data.get("lastReadMessageId")
    if not isinstance(last_read_id, int) or last_read_id < 1:
        return Response({"error": "lastReadMessageId must be a positive integer"}, status=http_status.HTTP_400_BAD_REQUEST)

    try:
        state = service_mark_read(request.user, room, last_read_id)
    except MessageNotFoundError:
        return Response({"error": "Message not found"}, status=http_status.HTTP_404_NOT_FOUND)

    # Sync with DirectInbox cache for DM rooms
    if room.kind == Room.Kind.DIRECT:
        from direct_inbox.state import mark_read as di_mark_read
        di_ttl = int(getattr(settings, "DIRECT_INBOX_UNREAD_TTL", 30 * 24 * 60 * 60))
        di_mark_read(request.user.pk, room.slug, di_ttl)

    _broadcast_to_room(room, {
        "type": "chat_read_receipt",
        "userId": request.user.pk,
        "username": request.user.username,
        "lastReadMessageId": state.last_read_message_id,
        "roomSlug": room.slug,
    })

    return Response({
        "roomSlug": room.slug,
        "lastReadMessageId": state.last_read_message_id,
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def unread_counts(request):
    items = get_unread_counts(request.user)
    return Response({"items": items})
