"""Содержит тесты модуля `test_health` подсистемы `chat`."""


from django.test import TestCase


class HealthApiTests(TestCase):
    """Группирует тестовые сценарии класса `HealthApiTests`."""
    def test_live_health_endpoint(self):
        """Проверяет сценарий `test_live_health_endpoint`."""
        response = self.client.get('/api/health/live/')
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['status'], 'ok')
        self.assertEqual(payload['check'], 'live')

    def test_ready_health_endpoint(self):
        """Проверяет сценарий `test_ready_health_endpoint`."""
        response = self.client.get('/api/health/ready/')
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['status'], 'ok')
        self.assertEqual(payload['check'], 'ready')
        self.assertEqual(payload['components']['database'], 'ok')
        self.assertEqual(payload['components']['cache'], 'ok')
