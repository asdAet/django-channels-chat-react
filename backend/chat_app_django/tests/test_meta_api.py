"""Tests for frontend runtime client-config endpoint."""

from django.test import TestCase, override_settings


class ClientConfigApiTests(TestCase):
    """Ensures runtime config endpoint exposes backend source-of-truth limits."""

    @override_settings(
        USERNAME_MAX_LENGTH=40,
        CHAT_MESSAGE_MAX_LENGTH=2048,
        CHAT_ROOM_SLUG_REGEX=r"^[a-z0-9-]{3,20}$",
        MEDIA_URL_TTL_SECONDS=120,
    )
    def test_client_config_returns_expected_shape(self):
        response = self.client.get("/api/meta/client-config/")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["usernameMaxLength"], 40)
        self.assertEqual(payload["chatMessageMaxLength"], 2048)
        self.assertEqual(payload["chatRoomSlugRegex"], r"^[a-z0-9-]{3,20}$")
        self.assertEqual(payload["mediaUrlTtlSeconds"], 120)
        self.assertEqual(payload["mediaMode"], "signed_only")
