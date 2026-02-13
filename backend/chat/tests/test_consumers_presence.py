"""Содержит тесты модуля `test_consumers_presence` подсистемы `chat`."""


import json

from asgiref.sync import async_to_sync
from channels.routing import URLRouter
from channels.testing import WebsocketCommunicator
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.test import TransactionTestCase

from chat.routing import websocket_urlpatterns

User = get_user_model()
application = URLRouter(websocket_urlpatterns)


class PresenceConsumerTests(TransactionTestCase):
    """Группирует тестовые сценарии класса `PresenceConsumerTests`."""
    def setUp(self):
        """Проверяет сценарий `setUp`."""
        self.user = User.objects.create_user(username='presence_user', password='pass12345')

    async def _connect(self, user=None, ip='198.51.100.10', port=55000):
        """Проверяет сценарий `_connect`."""
        communicator = WebsocketCommunicator(
            application,
            '/ws/presence/',
            headers=[(b'host', b'localhost')],
        )
        communicator.scope['user'] = user if user is not None else AnonymousUser()
        communicator.scope['client'] = (ip, port)
        connected, close_code = await communicator.connect()
        return communicator, connected, close_code

    def test_guest_connect_receives_count(self):
        """Проверяет сценарий `test_guest_connect_receives_count`."""
        async def run():
            """Проверяет сценарий `run`."""
            communicator, connected, _ = await self._connect()
            self.assertTrue(connected)
            payload = json.loads(await communicator.receive_from(timeout=2))
            self.assertIn('guests', payload)
            self.assertGreaterEqual(payload['guests'], 1)
            await communicator.disconnect()

        async_to_sync(run)()

    def test_authenticated_receives_online_list(self):
        """Проверяет сценарий `test_authenticated_receives_online_list`."""
        async def run():
            """Проверяет сценарий `run`."""
            communicator, connected, _ = await self._connect(user=self.user)
            self.assertTrue(connected)
            payload = json.loads(await communicator.receive_from(timeout=2))
            self.assertIn('online', payload)
            usernames = [entry['username'] for entry in payload['online']]
            self.assertIn(self.user.username, usernames)
            await communicator.disconnect()

        async_to_sync(run)()

    def test_guests_count_unique_by_ip(self):
        """Проверяет сценарий `test_guests_count_unique_by_ip`."""
        async def run():
            """Проверяет сценарий `run`."""
            first, connected1, _ = await self._connect(ip='203.0.113.5', port=50001)
            self.assertTrue(connected1)
            await first.receive_from(timeout=2)

            second, connected2, _ = await self._connect(ip='203.0.113.5', port=50002)
            self.assertTrue(connected2)
            payload_second = json.loads(await second.receive_from(timeout=2))
            self.assertEqual(payload_second.get('guests'), 1)

            await second.disconnect()
            await first.disconnect()

        async_to_sync(run)()
