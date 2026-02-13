"""Содержит тесты модуля `test_utils` подсистемы `chat`."""


from django.test import RequestFactory, SimpleTestCase, override_settings

from chat import utils
from chat.utils import build_profile_url, build_profile_url_from_request


class UtilityHelpersTests(SimpleTestCase):
    """Группирует тестовые сценарии класса `UtilityHelpersTests`."""
    def test_decode_header_variants(self):
        """Проверяет сценарий `test_decode_header_variants`."""
        self.assertIsNone(utils._decode_header(None))
        self.assertEqual(utils._decode_header(b'test'), 'test')
        self.assertEqual(utils._decode_header(b'\xff'), '\xff'.encode('latin-1').decode('latin-1'))

    def test_normalize_scheme(self):
        """Проверяет сценарий `test_normalize_scheme`."""
        self.assertEqual(utils._normalize_scheme('HTTP'), 'http')
        self.assertEqual(utils._normalize_scheme('wss'), 'https')
        self.assertEqual(utils._normalize_scheme('ws'), 'http')
        self.assertIsNone(utils._normalize_scheme('ftp'))

    def test_normalize_base_url(self):
        """Проверяет сценарий `test_normalize_base_url`."""
        self.assertEqual(utils._normalize_base_url('https://example.com/path'), 'https://example.com')
        self.assertIsNone(utils._normalize_base_url('ftp://example.com'))
        self.assertIsNone(utils._normalize_base_url('https:///path-only'))

    def test_base_from_host_and_scheme(self):
        """Проверяет сценарий `test_base_from_host_and_scheme`."""
        self.assertEqual(
            utils._base_from_host_and_scheme('example.com, proxy.local', 'https, http'),
            'https://example.com',
        )
        self.assertIsNone(utils._base_from_host_and_scheme('', 'https'))

    @override_settings(MEDIA_URL='/media/')
    def test_normalize_media_path_and_url_path(self):
        """Проверяет сценарий `test_normalize_media_path_and_url_path`."""
        self.assertEqual(utils.normalize_media_path('/media/profile_pics/a.jpg'), 'profile_pics/a.jpg')
        self.assertIsNone(utils.normalize_media_path('../secret.txt'))
        self.assertEqual(utils._media_url_path('profile_pics/a.jpg'), '/media/profile_pics/a.jpg')

    def test_internal_host_and_origin_preference(self):
        """Проверяет сценарий `test_internal_host_and_origin_preference`."""
        self.assertTrue(utils._is_internal_host('127.0.0.1'))
        self.assertTrue(utils._is_internal_host('localhost'))
        self.assertFalse(utils._is_internal_host('example.com'))
        self.assertTrue(
            utils._should_prefer_origin('http://172.18.0.2:8000', 'https://slowed.sbs')
        )

    def test_pick_base_url_priority(self):
        """Проверяет сценарий `test_pick_base_url_priority`."""
        self.assertEqual(
            utils._pick_base_url(
                configured_base='https://cdn.example.com',
                forwarded_base='https://forwarded.example.com',
                host_base='https://host.example.com',
                origin_base='https://origin.example.com',
            ),
            'https://cdn.example.com',
        )
        self.assertEqual(
            utils._pick_base_url(
                configured_base=None,
                forwarded_base='http://172.18.0.2:8000',
                host_base='http://172.18.0.3:8000',
                origin_base='https://origin.example.com',
            ),
            'https://origin.example.com',
        )

    @override_settings(MEDIA_URL='/media/')
    def test_coerce_media_source(self):
        """Проверяет сценарий `test_coerce_media_source`."""
        self.assertEqual(utils._coerce_media_source('profile_pics/a.jpg'), 'profile_pics/a.jpg')
        self.assertEqual(
            utils._coerce_media_source('http://127.0.0.1:8000/media/profile_pics/a.jpg'),
            'profile_pics/a.jpg',
        )
        self.assertEqual(
            utils._coerce_media_source('https://cdn.example.com/profile_pics/a.jpg'),
            'https://cdn.example.com/profile_pics/a.jpg',
        )


class BuildProfileUrlTests(SimpleTestCase):
    """Группирует тестовые сценарии класса `BuildProfileUrlTests`."""
    def _scope(self, headers=None, server=None, scheme='ws'):
        """Проверяет сценарий `_scope`."""
        return {
            'headers': headers or [],
            'server': server,
            'scheme': scheme,
        }

    @override_settings(MEDIA_URL='/media/')
    def test_prefers_host_over_origin_for_local_dev(self):
        """Проверяет сценарий `test_prefers_host_over_origin_for_local_dev`."""
        scope = self._scope(
            headers=[
                (b'origin', b'http://localhost:5173'),
                (b'host', b'localhost:8000'),
            ],
            server=('127.0.0.1', 8000),
            scheme='ws',
        )
        url = build_profile_url(scope, 'profile_pics/a.jpg')
        self.assertEqual(url, 'http://localhost:8000/media/profile_pics/a.jpg')

    @override_settings(MEDIA_URL='/media/')
    def test_prefers_origin_when_host_is_internal_but_origin_is_public(self):
        """Проверяет сценарий `test_prefers_origin_when_host_is_internal_but_origin_is_public`."""
        scope = self._scope(
            headers=[
                (b'origin', b'https://slowed.sbs'),
                (b'host', b'172.18.0.4:8000'),
            ],
            server=('172.18.0.4', 8000),
            scheme='ws',
        )
        url = build_profile_url(scope, 'profile_pics/a.jpg')
        self.assertEqual(url, 'https://slowed.sbs/media/profile_pics/a.jpg')

    @override_settings(MEDIA_URL='/media/')
    def test_uses_forwarded_host_and_proto(self):
        """Проверяет сценарий `test_uses_forwarded_host_and_proto`."""
        scope = self._scope(
            headers=[
                (b'x-forwarded-host', b'chat.example.com'),
                (b'x-forwarded-proto', b'https'),
            ],
            server=('172.18.0.4', 8000),
            scheme='ws',
        )
        url = build_profile_url(scope, 'profile_pics/a.jpg')
        self.assertEqual(url, 'https://chat.example.com/media/profile_pics/a.jpg')

    @override_settings(MEDIA_URL='/media/')
    def test_falls_back_to_server(self):
        """Проверяет сценарий `test_falls_back_to_server`."""
        scope = self._scope(headers=[], server=('172.18.0.4', 8000), scheme='ws')
        url = build_profile_url(scope, 'profile_pics/a.jpg')
        self.assertEqual(url, 'http://172.18.0.4:8000/media/profile_pics/a.jpg')

    @override_settings(MEDIA_URL='/media/')
    def test_rewrites_internal_absolute_url(self):
        """Проверяет сценарий `test_rewrites_internal_absolute_url`."""
        scope = self._scope(headers=[(b'origin', b'https://slowed.sbs')], scheme='wss')
        url = build_profile_url(scope, 'http://172.18.0.4:8000/media/profile_pics/a.jpg')
        self.assertEqual(url, 'https://slowed.sbs/media/profile_pics/a.jpg')

    def test_keeps_absolute_url(self):
        """Проверяет сценарий `test_keeps_absolute_url`."""
        scope = self._scope()
        url = build_profile_url(scope, 'https://cdn.example.com/a.jpg')
        self.assertEqual(url, 'https://cdn.example.com/a.jpg')

    @override_settings(MEDIA_URL='/media/')
    def test_rejects_traversal_path(self):
        """Проверяет сценарий `test_rejects_traversal_path`."""
        scope = self._scope(headers=[(b'host', b'example.com')], scheme='ws')
        url = build_profile_url(scope, '../secret.txt')
        self.assertIsNone(url)


class BuildProfileUrlFromRequestTests(SimpleTestCase):
    """Группирует тестовые сценарии класса `BuildProfileUrlFromRequestTests`."""
    def setUp(self):
        """Проверяет сценарий `setUp`."""
        self.factory = RequestFactory()

    @override_settings(MEDIA_URL='/media/', ALLOWED_HOSTS=['*'])
    def test_request_prefers_host_over_origin_for_local_dev(self):
        """Проверяет сценарий `test_request_prefers_host_over_origin_for_local_dev`."""
        request = self.factory.get(
            '/api/auth/session/',
            HTTP_HOST='localhost:8000',
            HTTP_ORIGIN='http://localhost:5173',
        )
        url = build_profile_url_from_request(request, 'profile_pics/a.jpg')
        self.assertEqual(url, 'http://localhost:8000/media/profile_pics/a.jpg')

    @override_settings(MEDIA_URL='/media/', ALLOWED_HOSTS=['*'])
    def test_request_prefers_origin_when_host_is_internal_but_origin_is_public(self):
        """Проверяет сценарий `test_request_prefers_origin_when_host_is_internal_but_origin_is_public`."""
        request = self.factory.get(
            '/api/auth/session/',
            HTTP_HOST='172.18.0.4:8000',
            HTTP_ORIGIN='https://slowed.sbs',
        )
        url = build_profile_url_from_request(request, 'profile_pics/a.jpg')
        self.assertEqual(url, 'https://slowed.sbs/media/profile_pics/a.jpg')

    @override_settings(MEDIA_URL='/media/', PUBLIC_BASE_URL='https://cdn.slowed.sbs')
    def test_request_prefers_configured_public_base(self):
        """Проверяет сценарий `test_request_prefers_configured_public_base`."""
        request = self.factory.get('/api/auth/session/')
        url = build_profile_url_from_request(request, 'profile_pics/a.jpg')
        self.assertEqual(url, 'https://cdn.slowed.sbs/media/profile_pics/a.jpg')

    @override_settings(MEDIA_URL='/media/', ALLOWED_HOSTS=['*'])
    def test_request_uses_forwarded_host_and_proto(self):
        """Проверяет сценарий `test_request_uses_forwarded_host_and_proto`."""
        request = self.factory.get(
            '/api/auth/session/',
            HTTP_X_FORWARDED_HOST='chat.example.com',
            HTTP_X_FORWARDED_PROTO='https',
        )
        url = build_profile_url_from_request(request, 'profile_pics/a.jpg')
        self.assertEqual(url, 'https://chat.example.com/media/profile_pics/a.jpg')

    @override_settings(MEDIA_URL='/media/', ALLOWED_HOSTS=['*'])
    def test_request_rewrites_internal_absolute_url(self):
        """Проверяет сценарий `test_request_rewrites_internal_absolute_url`."""
        request = self.factory.get(
            '/api/auth/session/',
            HTTP_HOST='127.0.0.1:8000',
            HTTP_ORIGIN='https://slowed.sbs',
        )
        url = build_profile_url_from_request(
            request,
            'http://127.0.0.1:8000/media/profile_pics/a.jpg',
        )
        self.assertEqual(url, 'https://slowed.sbs/media/profile_pics/a.jpg')

    @override_settings(MEDIA_URL='/media/', ALLOWED_HOSTS=['*'])
    def test_request_returns_relative_path_when_host_is_unavailable(self):
        """Проверяет сценарий `test_request_returns_relative_path_when_host_is_unavailable`."""
        request = self.factory.get('/api/auth/session/')
        with override_settings(ALLOWED_HOSTS=['invalid.local']):
            url = build_profile_url_from_request(request, 'profile_pics/a.jpg')
        self.assertEqual(url, '/media/profile_pics/a.jpg')
