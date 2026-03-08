"""WebSocket consumer for chat rooms."""

import asyncio
import json
import time

from asgiref.sync import sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.conf import settings
from django.core.exceptions import ObjectDoesNotExist
from django.db import IntegrityError, OperationalError, ProgrammingError

from chat_app_django.ip_utils import get_client_ip_from_scope
from chat_app_django.media_utils import build_profile_url, serialize_avatar_crop
from chat_app_django.security.audit import audit_ws_event
from chat_app_django.security.rate_limit import DbRateLimiter, RateLimitPolicy

from direct_inbox.state import (
    is_room_active,
    mark_read,
    mark_unread,
    user_group_name,
)
from messages.models import Message
from roles.access import can_read, can_write
from roles.models import Membership
from rooms.models import Room

from .constants import CHAT_CLOSE_IDLE_CODE, PUBLIC_ROOM_NAME, PUBLIC_ROOM_SLUG
from .utils import is_valid_room_slug as _is_valid_room_slug


def _ws_connect_rate_limited(scope, endpoint: str) -> bool:
    """Checks websocket connect rate limit per endpoint and IP."""
    limit = int(getattr(settings, "WS_CONNECT_RATE_LIMIT", 60))
    window = int(getattr(settings, "WS_CONNECT_RATE_WINDOW", 60))
    ip = get_client_ip_from_scope(scope) or "unknown"
    scope_key = f"rl:ws:connect:{endpoint}:{ip}"
    policy = RateLimitPolicy(limit=limit, window_seconds=window)
    return DbRateLimiter.is_limited(scope_key=scope_key, policy=policy)


class ChatConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer for chat room messaging."""

    chat_idle_timeout = int(getattr(settings, "CHAT_WS_IDLE_TIMEOUT", 600))
    direct_inbox_unread_ttl = int(getattr(settings, "DIRECT_INBOX_UNREAD_TTL", 30 * 24 * 60 * 60))

    async def connect(self):
        user = self.scope.get("user")
        if user is None:
            audit_ws_event("ws.connect.denied", self.scope, endpoint="chat", reason="missing_user", code=4401)
            await self.close(code=4401)
            return

        room_slug = None
        url_route = self.scope.get("url_route")
        if isinstance(url_route, dict):
            kwargs = url_route.get("kwargs")
            if isinstance(kwargs, dict):
                room_slug = kwargs.get("room_name")

        if not isinstance(room_slug, str):
            audit_ws_event("ws.connect.denied", self.scope, endpoint="chat", reason="invalid_slug", code=4404)
            await self.close(code=4404)
            return

        if await sync_to_async(_ws_connect_rate_limited)(self.scope, "chat"):
            audit_ws_event("ws.connect.denied", self.scope, endpoint="chat", reason="rate_limited", code=4429)
            await self.close(code=4429)
            return

        if room_slug != PUBLIC_ROOM_SLUG and not _is_valid_room_slug(room_slug):
            audit_ws_event("ws.connect.denied", self.scope, endpoint="chat", reason="invalid_slug", code=4404, room_slug=room_slug)
            await self.close(code=4404)
            return

        room = await self._load_room(room_slug)
        if not room:
            audit_ws_event("ws.connect.denied", self.scope, endpoint="chat", reason="room_not_found", code=4404, room_slug=room_slug)
            await self.close(code=4404)
            return

        if not await self._can_read(room, user):
            audit_ws_event("ws.connect.denied", self.scope, endpoint="chat", reason="forbidden", code=4403, room_slug=room_slug)
            await self.close(code=4403)
            return

        self.room = room
        self.room_name = room.slug
        room_identifier = room.pk if getattr(room, "pk", None) else room.slug
        self.room_group_name = f"chat_room_{room_identifier}"

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()
        audit_ws_event("ws.connect.accepted", self.scope, endpoint="chat", room_slug=self.room_name)

        self._last_activity = time.monotonic()
        self._last_typing_broadcast = 0.0
        self._idle_task = None
        if self.chat_idle_timeout > 0:
            self._idle_task = asyncio.create_task(self._idle_watchdog())

    async def disconnect(self, code):
        idle_task = getattr(self, "_idle_task", None)
        if idle_task:
            idle_task.cancel()
            try:
                await idle_task
            except asyncio.CancelledError:
                pass

        if hasattr(self, "room_group_name"):
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)
        audit_ws_event(
            "ws.disconnect",
            self.scope,
            endpoint="chat",
            code=code,
            room_slug=getattr(self, "room_name", None),
        )

    async def receive(self, text_data=None, bytes_data=None):
        self._last_activity = time.monotonic()
        if text_data is None and bytes_data is not None:
            try:
                text_data = bytes_data.decode("utf-8")
            except UnicodeDecodeError:
                audit_ws_event("ws.message.rejected", self.scope, endpoint="chat", reason="invalid_payload")
                return
        if text_data is None:
            return
        try:
            text_data_json = json.loads(text_data)
        except json.JSONDecodeError:
            audit_ws_event("ws.message.rejected", self.scope, endpoint="chat", reason="invalid_json")
            return

        event_type = text_data_json.get("type")

        if event_type == "typing":
            await self._handle_typing()
            return

        if event_type == "mark_read":
            await self._handle_mark_read(text_data_json)
            return

        message = text_data_json.get("message", "")
        if not isinstance(message, str):
            audit_ws_event("ws.message.rejected", self.scope, endpoint="chat", reason="invalid_payload")
            return
        message = message.strip()
        if not message:
            audit_ws_event("ws.message.rejected", self.scope, endpoint="chat", reason="empty_message")
            return

        max_len = int(getattr(settings, "CHAT_MESSAGE_MAX_LENGTH", 1000))
        if len(message) > max_len:
            audit_ws_event(
                "ws.message.rejected",
                self.scope,
                endpoint="chat",
                reason="message_too_long",
                room_slug=self.room.slug,
                message_length=len(message),
            )
            await self.send(text_data=json.dumps({"error": "message_too_long"}))
            return

        user = self.scope.get("user")
        if user is None or not getattr(user, "is_authenticated", False):
            audit_ws_event("ws.message.rejected", self.scope, endpoint="chat", reason="unauthorized")
            return

        if not await self._can_write(self.room, user):
            audit_ws_event(
                "ws.message.rejected",
                self.scope,
                endpoint="chat",
                reason="forbidden",
                room_slug=self.room.slug,
            )
            await self.send(text_data=json.dumps({"error": "forbidden"}))
            return

        if await self._rate_limited(user):
            audit_ws_event("ws.message.rate_limited", self.scope, endpoint="chat", room_slug=self.room.slug)
            await self.send(text_data=json.dumps({"error": "rate_limited"}))
            return

        if await self._slow_mode_limited(user):
            await self.send(text_data=json.dumps({"error": "slow_mode"}))
            return

        username = getattr(user, "username", "")
        if not username:
            audit_ws_event("ws.message.rejected", self.scope, endpoint="chat", reason="invalid_user")
            return
        room_slug = self.room.slug

        profile_name, avatar_crop = await self._get_profile_avatar_state(user)
        profile_url = build_profile_url(self.scope, profile_name)

        reply_to_id = text_data_json.get("replyTo")
        if reply_to_id is not None:
            try:
                reply_to_id = int(reply_to_id)
            except (TypeError, ValueError):
                reply_to_id = None

        saved_message = await self.save_message(message, user, username, profile_name, self.room, reply_to_id)
        created_at = saved_message.date_added.isoformat()
        audit_ws_event(
            "ws.message.sent",
            self.scope,
            endpoint="chat",
            room_slug=self.room.slug,
            message_length=len(message),
        )

        reply_to_data = await self._get_reply_data(saved_message) if reply_to_id else None

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "chat_message",
                "message": message,
                "username": username,
                "profile_pic": profile_url,
                "avatar_crop": avatar_crop,
                "room": room_slug,
                "id": saved_message.pk,
                "createdAt": created_at,
                "replyTo": reply_to_data,
            },
        )

        if self.room.kind == Room.Kind.DIRECT:
            sender_id = getattr(user, "pk", None)
            if sender_id is None:
                return
            targets = await self._build_direct_inbox_targets(
                room_id=self.room.pk,
                sender_id=int(sender_id),
                message=message,
                created_at=created_at,
            )
            for target in targets:
                await self.channel_layer.group_send(
                    target["group"],
                    {
                        "type": "direct_inbox_event",
                        "payload": target["payload"],
                    },
                )

    async def chat_message(self, event):
        self._last_activity = time.monotonic()
        await self.send(
            text_data=json.dumps(
                {
                    "message": event["message"],
                    "username": event["username"],
                    "profile_pic": event["profile_pic"],
                    "avatar_crop": event.get("avatar_crop"),
                    "room": event["room"],
                }
            )
        )

    async def _idle_watchdog(self):
        interval = max(10, min(60, self.chat_idle_timeout))
        while True:
            await asyncio.sleep(interval)
            if (time.monotonic() - self._last_activity) <= self.chat_idle_timeout:
                continue
            await self.close(code=CHAT_CLOSE_IDLE_CODE)
            break

    @sync_to_async
    def _load_room(self, slug: str):
        try:
            if slug == PUBLIC_ROOM_SLUG:
                room, _ = Room.objects.get_or_create(
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
            return Room.objects.filter(slug=slug).first()
        except (OperationalError, ProgrammingError, IntegrityError):
            return None

    @sync_to_async
    def _can_read(self, room: Room, user) -> bool:
        return can_read(room, user)

    @sync_to_async
    def _can_write(self, room: Room, user) -> bool:
        return can_write(room, user)

    @sync_to_async
    def save_message(self, message, user, username, profile_pic, room, reply_to_id=None):
        kwargs = {
            "message_content": message,
            "username": username,
            "user": user,
            "profile_pic": profile_pic,
            "room": room,
        }
        if reply_to_id is not None:
            exists = Message.objects.filter(
                pk=reply_to_id, room=room, is_deleted=False,
            ).exists()
            if exists:
                kwargs["reply_to_id"] = reply_to_id
        return Message.objects.create(**kwargs)

    @sync_to_async
    def _get_profile_avatar_state(self, user):
        try:
            profile = user.profile
            image = getattr(profile, "image", None)
            name = getattr(image, "name", "") or ""
            return name, serialize_avatar_crop(profile)
        except (AttributeError, ObjectDoesNotExist):
            return "", None

    @sync_to_async
    def _rate_limited(self, user) -> bool:
        """Checks chat message rate limit for the current user."""
        limit = int(getattr(settings, "CHAT_MESSAGE_RATE_LIMIT", 20))
        window = int(getattr(settings, "CHAT_MESSAGE_RATE_WINDOW", 10))
        scope_key = f"rl:chat:message:{user.pk}"
        policy = RateLimitPolicy(limit=limit, window_seconds=window)
        return DbRateLimiter.is_limited(scope_key=scope_key, policy=policy)

    @sync_to_async
    def _slow_mode_limited(self, user) -> bool:
        """Checks group slow mode: 1 message per slow_mode_seconds per user."""
        room = getattr(self, "room", None)
        if not room or room.kind != Room.Kind.GROUP:
            return False
        slow = getattr(room, "slow_mode_seconds", 0) or 0
        if slow <= 0:
            return False
        scope_key = f"rl:slow:{room.pk}:{user.pk}"
        policy = RateLimitPolicy(limit=1, window_seconds=slow)
        return DbRateLimiter.is_limited(scope_key=scope_key, policy=policy)

    # ── Typing indicator ────────────────────────────────────────────────

    async def _handle_typing(self):
        user = self.scope.get("user")
        if user is None or not getattr(user, "is_authenticated", False):
            return
        if not await self._can_write(self.room, user):
            return
        now = time.monotonic()
        if now - self._last_typing_broadcast < 3.0:
            return
        self._last_typing_broadcast = now
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "chat_typing",
                "username": user.username,
                "userId": user.pk,
                "sender_channel": self.channel_name,
            },
        )

    async def chat_typing(self, event):
        if event.get("sender_channel") == self.channel_name:
            return
        await self.send(text_data=json.dumps({
            "type": "typing",
            "username": event["username"],
            "userId": event["userId"],
        }))

    # ── Reply data helper ─────────────────────────────────────────────

    @sync_to_async
    def _get_reply_data(self, saved_message):
        reply = saved_message.reply_to
        if not reply:
            return None
        if reply.is_deleted:
            return {"id": reply.pk, "username": None, "content": "[deleted]"}
        return {
            "id": reply.pk,
            "username": reply.user.username if reply.user else reply.username,
            "content": reply.message_content[:150],
        }

    # ── Edit / Delete / Reaction / Read receipt handlers ──────────────

    async def chat_message_edit(self, event):
        self._last_activity = time.monotonic()
        await self.send(text_data=json.dumps({
            "type": "message_edit",
            "messageId": event["messageId"],
            "content": event["content"],
            "editedAt": event["editedAt"],
            "editedBy": event["editedBy"],
        }))

    async def chat_message_delete(self, event):
        self._last_activity = time.monotonic()
        await self.send(text_data=json.dumps({
            "type": "message_delete",
            "messageId": event["messageId"],
            "deletedBy": event["deletedBy"],
        }))

    async def chat_reaction_add(self, event):
        self._last_activity = time.monotonic()
        await self.send(text_data=json.dumps({
            "type": "reaction_add",
            "messageId": event["messageId"],
            "emoji": event["emoji"],
            "userId": event["userId"],
            "username": event["username"],
        }))

    async def chat_reaction_remove(self, event):
        self._last_activity = time.monotonic()
        await self.send(text_data=json.dumps({
            "type": "reaction_remove",
            "messageId": event["messageId"],
            "emoji": event["emoji"],
            "userId": event["userId"],
            "username": event["username"],
        }))

    async def chat_read_receipt(self, event):
        self._last_activity = time.monotonic()
        await self.send(text_data=json.dumps({
            "type": "read_receipt",
            "userId": event["userId"],
            "username": event["username"],
            "lastReadMessageId": event["lastReadMessageId"],
            "roomSlug": event["roomSlug"],
        }))

    # ── Mark read via WS ──────────────────────────────────────────────

    async def _handle_mark_read(self, data):
        user = self.scope.get("user")
        if user is None or not getattr(user, "is_authenticated", False):
            return
        last_read_id = data.get("lastReadMessageId")
        if not isinstance(last_read_id, int) or last_read_id < 1:
            return
        await self._do_mark_read(user, self.room, last_read_id)

    @sync_to_async
    def _do_mark_read(self, user, room, last_read_id):
        from .services import mark_read as service_mark_read
        try:
            state = service_mark_read(user, room, last_read_id)
        except Exception:
            return
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer
        channel_layer = get_channel_layer()
        if channel_layer is None:
            return
        room_identifier = room.pk if getattr(room, "pk", None) else room.slug
        group_name = f"chat_room_{room_identifier}"
        async_to_sync(channel_layer.group_send)(group_name, {
            "type": "chat_read_receipt",
            "userId": user.pk,
            "username": user.username,
            "lastReadMessageId": state.last_read_message_id,
            "roomSlug": room.slug,
        })

    @sync_to_async
    def _build_direct_inbox_targets(self, room_id: int, sender_id: int, message: str, created_at: str):
        room = Room.objects.filter(id=room_id, kind=Room.Kind.DIRECT).first()
        if not room:
            return []

        memberships = list(
            Membership.objects.filter(room=room, is_banned=False)
            .select_related("user", "user__profile")
            .order_by("id")
        )

        pair_user_ids: set[int] = set()
        if room.direct_pair_key and ":" in room.direct_pair_key:
            first, second = room.direct_pair_key.split(":", 1)
            try:
                pair_user_ids = {int(first), int(second)}
            except (TypeError, ValueError):
                pair_user_ids = set()
        if len(pair_user_ids) != 2:
            return []

        participants = []
        seen_user_ids: set[int] = set()
        for ms in memberships:
            user = ms.user
            if not user:
                continue
            if pair_user_ids and user.pk not in pair_user_ids:
                continue
            if user.pk in seen_user_ids:
                continue
            seen_user_ids.add(user.pk)
            participants.append(user)

        if pair_user_ids and seen_user_ids != pair_user_ids:
            return []

        if not participants:
            return []

        targets = []
        for participant in participants:
            peer = next((candidate for candidate in participants if candidate.pk != participant.pk), None)
            peer_image_name = ""
            peer_avatar_crop = None
            if peer:
                peer_profile = getattr(peer, "profile", None)
                peer_image = getattr(peer_profile, "image", None) if peer_profile else None
                peer_image_name = getattr(peer_image, "name", "") or ""
                peer_avatar_crop = serialize_avatar_crop(peer_profile)

            if participant.pk == sender_id or is_room_active(participant.pk, room.slug):
                unread_state = mark_read(participant.pk, room.slug, self.direct_inbox_unread_ttl)
            else:
                unread_state = mark_unread(participant.pk, room.slug, self.direct_inbox_unread_ttl)

            slugs = unread_state.get("slugs", [])
            raw_counts = unread_state.get("counts", {})
            counts = raw_counts if isinstance(raw_counts, dict) else {}
            if not counts and isinstance(slugs, list):
                counts = {slug: 1 for slug in slugs if isinstance(slug, str) and slug}
            unread_count = counts.get(room.slug, 0)
            payload = {
                "type": "direct_inbox_item",
                "item": {
                    "slug": room.slug,
                    "peer": {
                        "username": peer.username if peer else "",
                        "profileImage": build_profile_url(self.scope, peer_image_name) if peer_image_name else None,
                        "avatarCrop": peer_avatar_crop,
                    },
                    "lastMessage": message,
                    "lastMessageAt": created_at,
                },
                "unread": {
                    "roomSlug": room.slug,
                    "isUnread": unread_count > 0,
                    "dialogs": unread_state.get("dialogs", len(slugs)),
                    "slugs": slugs,
                    "counts": counts,
                },
            }
            targets.append({"group": user_group_name(participant.pk), "payload": payload})
        return targets
