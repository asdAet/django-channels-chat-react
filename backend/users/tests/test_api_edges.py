import json
from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import OperationalError
from django.http.request import RawPostDataException
from django.test import Client, RequestFactory, SimpleTestCase, TestCase

from users import api

User = get_user_model()


class _BodyRaisesRequest:
    META = {'CONTENT_TYPE': 'application/json'}

    def __init__(self, post=None):
        self.POST = post or {}

    @property
    def body(self):
        raise RawPostDataException('stream already consumed')


class _InvalidJsonRequest:
    META = {'CONTENT_TYPE': 'application/json'}

    def __init__(self, body: bytes, post=None):
        self._body = body
        self.POST = post or {}

    @property
    def body(self):
        return self._body


class UsersApiHelpersTests(SimpleTestCase):
    def setUp(self):
        self.factory = RequestFactory()

    def test_parse_body_returns_post_for_form_content_type(self):
        request = SimpleNamespace(
            META={'CONTENT_TYPE': 'multipart/form-data'},
            POST={'username': 'form-user'},
        )
        self.assertEqual(api._parse_body(request), {'username': 'form-user'})

    def test_parse_body_handles_raw_post_data_exception(self):
        request = _BodyRaisesRequest(post={'username': 'fallback'})
        self.assertEqual(api._parse_body(request), {'username': 'fallback'})

    def test_parse_body_invalid_json_falls_back_to_empty_dict(self):
        request = _InvalidJsonRequest(body=b'{bad-json', post={})
        self.assertEqual(api._parse_body(request), {})

    def test_collect_errors_merges_dicts(self):
        merged = api._collect_errors({'username': ['taken']}, {'password': ['weak']})
        self.assertEqual(merged, {'username': ['taken'], 'password': ['weak']})

    def test_public_profile_view_returns_404_when_username_empty(self):
        request = self.factory.get('/api/auth/users//')
        response = api.public_profile_view(request, username='')
        self.assertEqual(response.status_code, 404)


class AuthApiEdgeTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = Client(enforce_csrf_checks=True)
        self.user = User.objects.create_user(username='auth_edge_user', password='pass12345')

    def _csrf(self) -> str:
        response = self.client.get('/api/auth/csrf/')
        return response.cookies['csrftoken'].value

    def test_session_view_for_guest(self):
        response = self.client.get('/api/auth/session/')
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()['authenticated'])

    def test_login_rejects_empty_json_body(self):
        csrf = self._csrf()
        response = self.client.post(
            '/api/auth/login/',
            data=json.dumps({}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=csrf,
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('body', response.json()['errors'])

    def test_login_requires_both_username_and_password(self):
        csrf = self._csrf()
        response = self.client.post(
            '/api/auth/login/',
            data=json.dumps({'username': 'only-name'}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=csrf,
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('credentials', response.json()['errors'])

    def test_register_get_returns_usage_hint(self):
        response = self.client.get('/api/auth/register/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('POST', response.json()['detail'])

    def test_register_rejects_empty_payload(self):
        csrf = self._csrf()
        response = self.client.post(
            '/api/auth/register/',
            data=json.dumps({}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=csrf,
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('body', response.json()['errors'])

    def test_register_rejects_missing_username(self):
        csrf = self._csrf()
        response = self.client.post(
            '/api/auth/register/',
            data=json.dumps({'password1': 'pass12345', 'password2': 'pass12345'}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=csrf,
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('username', response.json()['errors'])

    def test_register_rejects_missing_password(self):
        csrf = self._csrf()
        response = self.client.post(
            '/api/auth/register/',
            data=json.dumps({'username': 'edge_user'}),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=csrf,
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('password', response.json()['errors'])

    def test_register_rejects_password_mismatch(self):
        csrf = self._csrf()
        response = self.client.post(
            '/api/auth/register/',
            data=json.dumps(
                {
                    'username': 'edge_user',
                    'password1': 'pass12345',
                    'password2': 'pass54321',
                }
            ),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=csrf,
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('password', response.json()['errors'])

    def test_register_returns_summary_for_non_password_form_errors(self):
        csrf = self._csrf()
        response = self.client.post(
            '/api/auth/register/',
            data=json.dumps(
                {
                    'username': 'bad user name',
                    'password1': 'pass12345',
                    'password2': 'pass12345',
                }
            ),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=csrf,
        )
        self.assertEqual(response.status_code, 400)
        payload = response.json()
        self.assertIn('errors', payload)
        self.assertIn('username', payload['errors'])
        self.assertTrue(payload['error'])

    def test_logout_handles_operational_error_when_updating_last_seen(self):
        self.client.force_login(self.user)
        csrf = self._csrf()

        with patch('users.api.Profile.save', side_effect=OperationalError):
            response = self.client.post('/api/auth/logout/', HTTP_X_CSRFTOKEN=csrf)

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['ok'])

    def test_public_profile_not_found(self):
        response = self.client.get('/api/auth/users/missing-user/')
        self.assertEqual(response.status_code, 404)
