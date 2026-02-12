import json
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db import OperationalError
from django.test import Client, RequestFactory, SimpleTestCase, TestCase, override_settings

from chat import api
from chat.models import Message, Room

User = get_user_model()


class _BrokenProfileValue:
    @property
    def url(self):
        raise ValueError('bad value')

    def __str__(self):
        return 'profile_pics/fallback.jpg'


class ChatApiHelpersTests(SimpleTestCase):
    def setUp(self):
        self.factory = RequestFactory()

    def test_build_profile_pic_url_returns_none_for_empty(self):
        request = self.factory.get('/api/chat/public-room/')
        self.assertIsNone(api._build_profile_pic_url(request, None))

    @override_settings(PUBLIC_BASE_URL='https://example.com', MEDIA_URL='/media/')
    def test_build_profile_pic_url_falls_back_to_string_value(self):
        request = self.factory.get('/api/chat/public-room/')
        url = api._build_profile_pic_url(request, _BrokenProfileValue())
        self.assertEqual(url, 'https://example.com/media/profile_pics/fallback.jpg')

    @override_settings(CHAT_ROOM_SLUG_REGEX='[')
    def test_is_valid_room_slug_handles_invalid_regex(self):
        self.assertFalse(api._is_valid_room_slug('room-name'))

    def test_parse_positive_int_raises_for_invalid_value(self):
        with self.assertRaises(ValueError):
            api._parse_positive_int('bad', 'limit')

    def test_public_room_returns_fallback_when_db_unavailable(self):
        with patch('chat.api.Room.objects.get_or_create', side_effect=OperationalError):
            room = api._public_room()
        self.assertEqual(room.slug, 'public')
        self.assertEqual(room.name, 'Public Chat')


class RoomDetailsApiTests(TestCase):
    def setUp(self):
        self.client = Client(enforce_csrf_checks=True)
        self.user = User.objects.create_user(username='owner', password='pass12345')
        self.other = User.objects.create_user(username='other', password='pass12345')

    def test_public_room_details(self):
        response = self.client.get('/api/chat/rooms/public/')
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['slug'], 'public')
        self.assertFalse(payload['created'])

    def test_invalid_private_slug_returns_400(self):
        response = self.client.get('/api/chat/rooms/bad%2Fslug/')
        self.assertEqual(response.status_code, 400)

    def test_private_room_requires_auth(self):
        response = self.client.get('/api/chat/rooms/private123/')
        self.assertEqual(response.status_code, 401)

    def test_room_created_for_authenticated_user(self):
        self.client.force_login(self.user)
        response = self.client.get('/api/chat/rooms/private123/')
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload['created'])
        self.assertEqual(payload['createdBy'], self.user.username)

    def test_existing_room_owned_by_other_user_returns_conflict(self):
        Room.objects.create(slug='private123', name='private123', created_by=self.other)
        self.client.force_login(self.user)

        response = self.client.get('/api/chat/rooms/private123/')
        self.assertEqual(response.status_code, 409)

    def test_existing_room_owned_by_request_user_is_reused(self):
        room = Room.objects.create(slug='private123', name='private123', created_by=self.user)
        self.client.force_login(self.user)

        response = self.client.get('/api/chat/rooms/private123/')
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertFalse(payload['created'])
        self.assertEqual(payload['slug'], room.slug)

    def test_room_details_returns_fallback_payload_when_db_unavailable(self):
        self.client.force_login(self.user)
        with patch('chat.api.Room.objects.filter', side_effect=OperationalError):
            response = self.client.get('/api/chat/rooms/private123/')

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['slug'], 'private123')
        self.assertTrue(payload['created'])
        self.assertIsNone(payload['createdBy'])


class RoomMessagesApiTests(TestCase):
    def setUp(self):
        self.client = Client(enforce_csrf_checks=True)
        self.user = User.objects.create_user(username='chat_user', password='pass12345')

    def _create_messages(self, total: int, room: str = 'public'):
        for i in range(total):
            Message.objects.create(
                username='legacy_name',
                user=self.user,
                room=room,
                message_content=f'message-{i}',
                profile_pic='profile_pics/legacy.jpg',
            )

    @override_settings(CHAT_MESSAGES_PAGE_SIZE=50, CHAT_MESSAGES_MAX_PAGE_SIZE=200)
    def test_room_messages_default_pagination(self):
        self._create_messages(60)

        response = self.client.get('/api/chat/rooms/public/messages/')
        self.assertEqual(response.status_code, 200)
        payload = response.json()

        self.assertEqual(len(payload['messages']), 50)
        self.assertTrue(payload['pagination']['hasMore'])
        self.assertEqual(payload['pagination']['limit'], 50)
        self.assertEqual(payload['pagination']['nextBefore'], payload['messages'][0]['id'])

    @override_settings(CHAT_MESSAGES_PAGE_SIZE=10, CHAT_MESSAGES_MAX_PAGE_SIZE=20)
    def test_room_messages_limit_is_capped_by_max_page_size(self):
        self._create_messages(30)

        response = self.client.get('/api/chat/rooms/public/messages/?limit=999')
        self.assertEqual(response.status_code, 200)
        payload = response.json()

        self.assertEqual(payload['pagination']['limit'], 20)
        self.assertEqual(len(payload['messages']), 20)

    def test_room_messages_with_before_cursor(self):
        self._create_messages(6)
        newest_batch = self.client.get('/api/chat/rooms/public/messages/?limit=3').json()
        before = newest_batch['pagination']['nextBefore']

        response = self.client.get(f'/api/chat/rooms/public/messages/?limit=3&before={before}')
        self.assertEqual(response.status_code, 200)
        payload = response.json()

        self.assertEqual(len(payload['messages']), 3)
        self.assertFalse(payload['pagination']['hasMore'])

    def test_room_messages_invalid_limit_returns_400(self):
        response = self.client.get('/api/chat/rooms/public/messages/?limit=bad')
        self.assertEqual(response.status_code, 400)

    def test_room_messages_invalid_before_returns_400(self):
        response = self.client.get('/api/chat/rooms/public/messages/?before=0')
        self.assertEqual(response.status_code, 400)

    def test_room_messages_invalid_slug_returns_400(self):
        response = self.client.get('/api/chat/rooms/public%2Fbad/messages/')
        self.assertEqual(response.status_code, 400)

    def test_private_room_messages_require_auth(self):
        response = self.client.get('/api/chat/rooms/private123/messages/')
        self.assertEqual(response.status_code, 401)

    @override_settings(PUBLIC_BASE_URL='https://example.com', MEDIA_URL='/media/')
    def test_room_messages_prefers_related_user_fields(self):
        message = Message.objects.create(
            username='legacy_name',
            user=self.user,
            room='public',
            message_content='hello',
            profile_pic='profile_pics/legacy.jpg',
        )

        response = self.client.get('/api/chat/rooms/public/messages/?limit=1')
        self.assertEqual(response.status_code, 200)
        payload = response.json()

        item = payload['messages'][0]
        self.assertEqual(item['id'], message.id)
        self.assertEqual(item['username'], self.user.username)
        self.assertIn('/media/', item['profilePic'])

    @override_settings(PUBLIC_BASE_URL='https://example.com', MEDIA_URL='/media/')
    def test_room_messages_fallback_to_stored_profile_pic_without_user(self):
        Message.objects.create(
            username='legacy_name',
            room='public',
            message_content='hello',
            profile_pic='profile_pics/legacy.jpg',
        )

        response = self.client.get('/api/chat/rooms/public/messages/?limit=1')
        self.assertEqual(response.status_code, 200)
        item = response.json()['messages'][0]

        self.assertEqual(item['username'], 'legacy_name')
        self.assertEqual(item['profilePic'], 'https://example.com/media/profile_pics/legacy.jpg')

    def test_room_messages_returns_empty_payload_when_db_unavailable(self):
        with patch('chat.api.Message.objects.filter', side_effect=OperationalError):
            response = self.client.get('/api/chat/rooms/public/messages/')

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['messages'], [])
        self.assertFalse(payload['pagination']['hasMore'])


class ChatAuthSmokeTests(TestCase):
    def setUp(self):
        self.client = Client(enforce_csrf_checks=True)

    def _csrf(self):
        response = self.client.get('/api/auth/csrf/')
        return response.cookies['csrftoken'].value

    def test_register_and_login(self):
        csrf = self._csrf()
        register_payload = {
            'username': 'testuser',
            'password1': 'pass12345',
            'password2': 'pass12345',
        }
        response = self.client.post(
            '/api/auth/register/',
            data=json.dumps(register_payload),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=csrf,
        )
        self.assertIn(response.status_code, [200, 201])

        csrf = self._csrf()
        login_payload = {'username': 'testuser', 'password': 'pass12345'}
        response = self.client.post(
            '/api/auth/login/',
            data=json.dumps(login_payload),
            content_type='application/json',
            HTTP_X_CSRFTOKEN=csrf,
        )
        self.assertEqual(response.status_code, 200)
