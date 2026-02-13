
"""Содержит тесты модуля `test_models` подсистемы `chat`."""


from django.contrib.auth import get_user_model
from django.test import TestCase

from chat.models import ChatRole, Message, Room

User = get_user_model()


class ChatModelsTests(TestCase):
    """Группирует тестовые сценарии класса `ChatModelsTests`."""
    def test_message_str_uses_related_user_when_available(self):
        """Проверяет сценарий `test_message_str_uses_related_user_when_available`."""
        user = User.objects.create_user(username='msg_user', password='pass12345')
        message = Message.objects.create(
            username='legacy',
            user=user,
            room='public',
            message_content='hello',
        )
        self.assertEqual(str(message), 'msg_user: hello')

    def test_message_str_falls_back_to_username_field(self):
        """Проверяет сценарий `test_message_str_falls_back_to_username_field`."""
        message = Message.objects.create(
            username='legacy',
            room='public',
            message_content='hello',
        )
        self.assertEqual(str(message), 'legacy: hello')

    def test_room_str_returns_name(self):
        """Проверяет сценарий `test_room_str_returns_name`."""
        room = Room.objects.create(name='My Room', slug='my-room', kind=Room.Kind.PRIVATE)
        self.assertEqual(str(room), 'My Room')

    def test_room_defaults_to_private_kind(self):
        """Проверяет сценарий `test_room_defaults_to_private_kind`."""
        room = Room.objects.create(name='Room', slug='room-123')
        self.assertEqual(room.kind, Room.Kind.PRIVATE)

    def test_chat_role_str(self):
        """Проверяет сценарий `test_chat_role_str`."""
        user = User.objects.create_user(username='role_user', password='pass12345')
        room = Room.objects.create(name='Role Room', slug='role-room', kind=Room.Kind.PRIVATE)
        role = ChatRole.objects.create(
            room=room,
            user=user,
            role=ChatRole.Role.MEMBER,
            username_snapshot=user.username,
            granted_by=user,
        )
        self.assertEqual(str(role), f'{room.slug}:{user.username}:{ChatRole.Role.MEMBER}')
