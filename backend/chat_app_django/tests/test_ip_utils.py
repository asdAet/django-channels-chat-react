"""Содержит тесты модуля `test_ip_utils` подсистемы `chat_app_django`."""


from django.test import RequestFactory, SimpleTestCase, override_settings

from chat_app_django import ip_utils


class IpUtilsTests(SimpleTestCase):
    """Группирует тестовые сценарии класса `IpUtilsTests`."""
    def setUp(self):
        """Проверяет сценарий `setUp`."""
        self.factory = RequestFactory()
        ip_utils._trusted_networks.cache_clear()

    def tearDown(self):
        """Проверяет сценарий `tearDown`."""
        ip_utils._trusted_networks.cache_clear()

    def test_decode_header_and_parse_helpers(self):
        """Проверяет сценарий `test_decode_header_and_parse_helpers`."""
        self.assertIsNone(ip_utils._decode_header(None))
        self.assertEqual(ip_utils._decode_header(b'test'), 'test')
        self.assertEqual(ip_utils._decode_header(b'\xff'), '\xff'.encode('latin-1').decode('latin-1'))

        self.assertEqual(ip_utils._first_value('1.1.1.1, 2.2.2.2'), '1.1.1.1')
        self.assertIsNone(ip_utils._parse_ip('not-an-ip'))
        self.assertEqual(ip_utils._parse_ip('203.0.113.10'), '203.0.113.10')

    @override_settings(TRUSTED_PROXY_IPS=[], TRUSTED_PROXY_RANGES=[])
    def test_request_uses_remote_addr_when_proxy_untrusted(self):
        """Проверяет сценарий `test_request_uses_remote_addr_when_proxy_untrusted`."""
        request = self.factory.get(
            '/api/auth/session/',
            REMOTE_ADDR='203.0.113.5',
            HTTP_X_FORWARDED_FOR='198.51.100.10',
        )
        self.assertEqual(ip_utils.get_client_ip_from_request(request), '203.0.113.5')

    @override_settings(TRUSTED_PROXY_RANGES=['127.0.0.1/32'])
    def test_request_uses_cf_connecting_ip_when_proxy_trusted(self):
        """Проверяет сценарий `test_request_uses_cf_connecting_ip_when_proxy_trusted`."""
        request = self.factory.get(
            '/api/auth/session/',
            REMOTE_ADDR='127.0.0.1',
            HTTP_CF_CONNECTING_IP='198.51.100.20',
        )
        self.assertEqual(ip_utils.get_client_ip_from_request(request), '198.51.100.20')

    @override_settings(TRUSTED_PROXY_RANGES=['127.0.0.1/32'])
    def test_request_falls_back_to_remote_when_forwarded_is_invalid(self):
        """Проверяет сценарий `test_request_falls_back_to_remote_when_forwarded_is_invalid`."""
        request = self.factory.get(
            '/api/auth/session/',
            REMOTE_ADDR='127.0.0.1',
            HTTP_X_FORWARDED_FOR='not-an-ip',
        )
        self.assertEqual(ip_utils.get_client_ip_from_request(request), '127.0.0.1')

    @override_settings(TRUSTED_PROXY_RANGES=['127.0.0.1/32'])
    def test_scope_uses_forwarded_when_proxy_trusted(self):
        """Проверяет сценарий `test_scope_uses_forwarded_when_proxy_trusted`."""
        scope = {
            'client': ('127.0.0.1', 55000),
            'headers': [
                (b'x-forwarded-for', b'198.51.100.30, 127.0.0.1'),
            ],
        }
        self.assertEqual(ip_utils.get_client_ip_from_scope(scope), '198.51.100.30')

    @override_settings(TRUSTED_PROXY_RANGES=['127.0.0.1/32'])
    def test_scope_falls_back_to_remote_for_invalid_forwarded_header(self):
        """Проверяет сценарий `test_scope_falls_back_to_remote_for_invalid_forwarded_header`."""
        scope = {
            'client': ('127.0.0.1', 55000),
            'headers': [
                (b'x-forwarded-for', b'invalid'),
            ],
        }
        self.assertEqual(ip_utils.get_client_ip_from_scope(scope), '127.0.0.1')
