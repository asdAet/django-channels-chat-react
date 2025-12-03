import hashlib
import json
from asgiref.sync import sync_to_async
from django.utils.text import slugify
from django.conf import settings
from django.core.cache import cache

from channels.generic.websocket import AsyncWebsocketConsumer

from .constants import PUBLIC_ROOM_SLUG
from . models import Message


class ChatConsumer(AsyncWebsocketConsumer):
    """
    A consumer does three things:
    1. Accepts connections.
    2. Receives messages from client.
    3. Disconnects when the job is done.
    """

    async def connect(self):
        """
        Connect to a room
        """
        user = self.scope['user']
        self.room_name = self.scope['url_route']['kwargs']['room_name']

        is_public = self.room_name == PUBLIC_ROOM_SLUG
        if not user.is_authenticated and not is_public:
            await self.send({"close": True})
            return

        # Channels группа должна содержать только ASCII. Сначала пробуем безопасный slug,
        # если он пустой (например, на полностью юникодных названиях) — используем sha1-хэш.
        normalized = slugify(self.room_name)
        if not normalized:
            normalized = hashlib.sha1(self.room_name.encode("utf-8")).hexdigest()
        normalized = normalized[:80]  # ограничим длину чтобы пройти валидацию Channels
        self.room_group_name = f"chat_{normalized}"

        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        """
        Disconnect from channel

        :param close_code: optional
        """
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        """
        Receive messages from WebSocket

        :param text_data: message
        """

        text_data_json = json.loads(text_data)
        message = text_data_json['message']
        username = text_data_json['username']
        room = text_data_json['room']

        user = self.scope['user']
        if not user.is_authenticated:
            # Запрещаем постинг для неавторизованных, но соединение остаётся для чтения.
            return

        profile_name = await self._get_profile_image_name(user)
        profile_url = self._build_profile_url(profile_name)

        # Save message to DB
        await self.save_message(message, username, profile_name, room)

        # Send message to room group
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'chat_message',
                'message': message,
                'username': username,
                'profile_pic': profile_url,
                'room': room,
            }
        )

    async def chat_message(self, event):
        """
        Receive messages from room group

        :param event: Events to pick up
        """
        message = event['message']
        username = event['username']
        profile_pic = event['profile_pic']
        room = event['room']

        # Send message to WebSocket
        await self.send(text_data=json.dumps({
            'message': message,
            'username': username,
            'profile_pic': profile_pic,
            'room': room,
        }))

    @sync_to_async
    def save_message(self, message, username, profile_pic, room):
        Message.objects.create(
            message_content=message,
            username=username,
            profile_pic=profile_pic,
            room=room,
        )

    @sync_to_async
    def _get_profile_image_name(self, user) -> str:
        try:
            profile = user.profile
            name = getattr(profile.image, "name", "")
            return name or ""
        except Exception:
            return ""

    def _build_profile_url(self, image_name: str) -> str:
        """
        Return an absolute URL for the profile image based on the current connection.
        """
        # If it's already an absolute URL, return as is.
        if image_name.startswith("http://") or image_name.startswith("https://"):
            return image_name

        # Ensure leading slash for media path
        media_url = settings.MEDIA_URL or "/media/"
        if not media_url.startswith("/"):
            media_url = f"/{media_url}"
        if not media_url.endswith("/"):
            media_url = f"{media_url}/"

        path = image_name
        if not path.startswith("/"):
            path = f"{media_url}{image_name}"

        # Prefer actual server socket, then Host header.
        server = self.scope.get("server") or (None, None)
        host_val, port_val = server

        if not host_val:
            for header, value in self.scope.get("headers", []):
                if header == b"host":
                    host_val = value.decode("utf-8")
                    break

        if host_val:
            # If host already contains port, keep it; otherwise attach scope port.
            if ":" not in host_val and port_val:
                host_val = f"{host_val}:{port_val}"
            scheme = "https" if self.scope.get("scheme") == "wss" else "http"
            return f"{scheme}://{host_val}{path}"

        return path


class PresenceConsumer(AsyncWebsocketConsumer):
    group_name = "presence"
    cache_key = "presence:online"

    async def connect(self):
        user = self.scope.get("user")
        if not user or not user.is_authenticated:
            await self.close()
            return

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self._add_user(user)
        await self._broadcast()

    async def disconnect(self, close_code):
        user = self.scope.get("user")
        if user and user.is_authenticated:
            await self._remove_user(user)
            await self._broadcast()
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def _broadcast(self):
        online = await self._get_online()
        await self.channel_layer.group_send(
            self.group_name,
            {"type": "presence.update", "online": online},
        )

    async def presence_update(self, event):
        await self.send(text_data=json.dumps({"online": event["online"]}))

    @sync_to_async
    def _add_user(self, user):
        data = cache.get(self.cache_key, {})
        current = data.get(user.username, {})
        count = current.get("count", 0) + 1
        image_name = getattr(getattr(user, "profile", None), "image", None)
        image_name = image_name.name if image_name else ""
        image_url = self._build_profile_url(image_name) if image_name else None
        data[user.username] = {"count": count, "profileImage": image_url}
        cache.set(self.cache_key, data, timeout=60 * 60)

    @sync_to_async
    def _remove_user(self, user):
        data = cache.get(self.cache_key, {})
        if user.username in data:
            count = data[user.username].get("count", 1) - 1
            if count <= 0:
                data.pop(user.username, None)
            else:
                data[user.username]["count"] = count
            cache.set(self.cache_key, data, timeout=60 * 60)

    @sync_to_async
    def _get_online(self):
        data = cache.get(self.cache_key, {})
        cleaned = {k: v for k, v in data.items() if v.get("count", 0) > 0}
        if cleaned != data:
            cache.set(self.cache_key, cleaned, timeout=60 * 60)
        return [
            {"username": username, "profileImage": info.get("profileImage")}
            for username, info in cleaned.items()
        ]

    def _build_profile_url(self, image_name: str) -> str:
        if not image_name:
            return ""
        if image_name.startswith("http://") or image_name.startswith("https://"):
            return image_name

        media_url = settings.MEDIA_URL or "/media/"
        if not media_url.startswith("/"):
            media_url = f"/{media_url}"
        if not media_url.endswith("/"):
            media_url = f"{media_url}/"

        path = image_name
        if not path.startswith("/"):
            path = f"{media_url}{image_name}"

        server = self.scope.get("server") or (None, None)
        host_val, port_val = server

        if not host_val:
            for header, value in self.scope.get("headers", []):
                if header == b"host":
                    host_val = value.decode("utf-8")
                    break

        if host_val:
            if ":" not in host_val and port_val:
                host_val = f"{host_val}:{port_val}"
            scheme = "https" if self.scope.get("scheme") == "wss" else "http"
            return f"{scheme}://{host_val}{path}"

        return path
