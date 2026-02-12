import json
from unittest.mock import patch

from asgiref.sync import async_to_sync
from channels.routing import URLRouter
from channels.testing import WebsocketCommunicator
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.core.cache import cache
from django.test import TransactionTestCase, override_settings

from chat.models import Message
from chat.routing import websocket_urlpatterns

User = get_user_model()
application = URLRouter(websocket_urlpatterns)


class ChatConsumerTests(TransactionTestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(username='wsuser', password='pass12345')

    async def _connect(self, path: str, user=None):
        communicator = WebsocketCommunicator(
            application,
            path,
            headers=[(b'host', b'localhost')],
        )
        communicator.scope['user'] = user if user is not None else AnonymousUser()
        communicator.scope['client'] = ('127.0.0.1', 50001)
        connected, close_code = await communicator.connect()
        return communicator, connected, close_code

    def test_public_connect(self):
        async def run():
            communicator, connected, _ = await self._connect('/ws/chat/public/')
            self.assertTrue(connected)
            await communicator.disconnect()

        async_to_sync(run)()

    def test_invalid_room_rejected(self):
        async def run():
            _communicator, connected, _ = await self._connect('/ws/chat/public%2Fbad/')
            self.assertFalse(connected)

        async_to_sync(run)()

    def test_private_requires_auth(self):
        async def run():
            _communicator, connected, close_code = await self._connect('/ws/chat/private123/')
            self.assertFalse(connected)
            self.assertEqual(close_code, 4401)

        async_to_sync(run)()

    def test_connect_uses_hashed_group_name_when_slugify_returns_empty(self):
        async def run():
            with patch('chat.consumers.slugify', return_value=''):
                communicator, connected, _ = await self._connect('/ws/chat/private123/', user=self.user)
                self.assertTrue(connected)
                await communicator.disconnect()

        async_to_sync(run)()

    def test_invalid_json_non_string_and_blank_messages_are_ignored(self):
        async def run():
            communicator, connected, _ = await self._connect('/ws/chat/private123/', user=self.user)
            self.assertTrue(connected)

            await communicator.send_to(text_data='not-json')
            self.assertTrue(await communicator.receive_nothing(timeout=0.2))

            await communicator.send_to(text_data=json.dumps({'message': 123}))
            self.assertTrue(await communicator.receive_nothing(timeout=0.2))

            await communicator.send_to(text_data=json.dumps({'message': '   '}))
            self.assertTrue(await communicator.receive_nothing(timeout=0.2))

            await communicator.disconnect()

        async_to_sync(run)()

    def test_unauthenticated_public_user_cannot_send_messages(self):
        async def run():
            communicator, connected, _ = await self._connect('/ws/chat/public/')
            self.assertTrue(connected)

            await communicator.send_to(text_data=json.dumps({'message': 'hello'}))
            self.assertTrue(await communicator.receive_nothing(timeout=0.2))

            await communicator.disconnect()

        async_to_sync(run)()
        self.assertFalse(Message.objects.filter(message_content='hello').exists())

    def test_message_too_long(self):
        @override_settings(CHAT_MESSAGE_MAX_LENGTH=10)
        def inner():
            async def run():
                communicator, connected, _ = await self._connect('/ws/chat/private123/', user=self.user)
                self.assertTrue(connected)
                await communicator.send_to(
                    text_data=json.dumps(
                        {
                            'message': 'x' * 20,
                            'username': self.user.username,
                            'profile_pic': None,
                            'room': 'private123',
                        }
                    )
                )
                payload = json.loads(await communicator.receive_from(timeout=2))
                self.assertEqual(payload.get('error'), 'message_too_long')
                await communicator.disconnect()

            async_to_sync(run)()

        inner()

    def test_message_persisted(self):
        async def run():
            communicator, connected, _ = await self._connect('/ws/chat/private123/', user=self.user)
            self.assertTrue(connected)
            await communicator.send_to(
                text_data=json.dumps(
                    {
                        'message': 'hello',
                        'username': self.user.username,
                        'profile_pic': None,
                        'room': 'private123',
                    }
                )
            )
            event = json.loads(await communicator.receive_from(timeout=2))
            self.assertEqual(event.get('message'), 'hello')
            self.assertEqual(event.get('username'), self.user.username)
            await communicator.disconnect()

        async_to_sync(run)()
        self.assertTrue(Message.objects.filter(room='private123', message_content='hello').exists())

    @override_settings(CHAT_MESSAGE_RATE_LIMIT=1, CHAT_MESSAGE_RATE_WINDOW=30)
    def test_rate_limit(self):
        async def run():
            communicator, connected, _ = await self._connect('/ws/chat/private123/', user=self.user)
            self.assertTrue(connected)

            await communicator.send_to(
                text_data=json.dumps(
                    {
                        'message': 'first',
                        'username': self.user.username,
                        'profile_pic': None,
                        'room': 'private123',
                    }
                )
            )
            await communicator.receive_from(timeout=2)

            await communicator.send_to(
                text_data=json.dumps(
                    {
                        'message': 'second',
                        'username': self.user.username,
                        'profile_pic': None,
                        'room': 'private123',
                    }
                )
            )
            payload = json.loads(await communicator.receive_from(timeout=2))
            self.assertEqual(payload.get('error'), 'rate_limited')
            await communicator.disconnect()

        async_to_sync(run)()
