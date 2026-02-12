from django.test import TestCase


class HealthApiTests(TestCase):
    def test_live_health_endpoint(self):
        response = self.client.get('/api/health/live/')
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['status'], 'ok')
        self.assertEqual(payload['check'], 'live')

    def test_ready_health_endpoint(self):
        response = self.client.get('/api/health/ready/')
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['status'], 'ok')
        self.assertEqual(payload['check'], 'ready')
        self.assertEqual(payload['components']['database'], 'ok')
        self.assertEqual(payload['components']['cache'], 'ok')
