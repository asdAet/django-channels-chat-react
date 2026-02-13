"""Содержит тесты модуля `test_health` подсистемы `chat_app_django`."""


import json
from unittest import mock

from django.db.utils import DatabaseError
from django.test import RequestFactory, SimpleTestCase

from chat_app_django import health


class HealthUnitTests(SimpleTestCase):
    """Группирует тестовые сценарии класса `HealthUnitTests`."""
    def setUp(self):
        """Проверяет сценарий `setUp`."""
        self.factory = RequestFactory()

    def test_live_returns_ok(self):
        """Проверяет сценарий `test_live_returns_ok`."""
        request = self.factory.get('/api/health/live/')
        response = health.live(request)
        self.assertEqual(response.status_code, 200)

    @mock.patch('chat_app_django.health.cache')
    @mock.patch('chat_app_django.health.connections')
    def test_ready_returns_503_when_dependencies_fail(self, mocked_connections, mocked_cache):
        """Проверяет сценарий `test_ready_returns_503_when_dependencies_fail`."""
        request = self.factory.get('/api/health/ready/')

        mocked_cursor = mock.MagicMock()
        mocked_cursor.__enter__.side_effect = DatabaseError('db down')
        mocked_connections.__getitem__.return_value.cursor.return_value = mocked_cursor
        mocked_cache.set.side_effect = RuntimeError('cache down')

        response = health.ready(request)
        self.assertEqual(response.status_code, 503)
        payload = json.loads(response.content)
        self.assertEqual(payload['status'], 'error')
        self.assertEqual(payload['components']['database'], 'error')
        self.assertEqual(payload['components']['cache'], 'error')
