"""Tests for the friends management API."""

from urllib.parse import parse_qs, urlparse

from django.contrib.auth import get_user_model
from django.test import Client, TestCase

from friends.models import Friendship

User = get_user_model()


def _assert_signed_media_url(url: str):
    parsed = urlparse(url)
    assert parsed.path.startswith("/api/auth/media/")
    query = parse_qs(parsed.query)
    assert "exp" in query
    assert "sig" in query


class FriendsApiTestBase(TestCase):
    def setUp(self):
        self.client = Client()
        self.alice = User.objects.create_user(username="alice", password="pass12345")
        self.bob = User.objects.create_user(username="bob", password="pass12345")
        self.charlie = User.objects.create_user(username="charlie", password="pass12345")

    def _login(self, user):
        self.client.force_login(user)


class SendRequestTests(FriendsApiTestBase):
    def test_send_request_creates_pending(self):
        self._login(self.alice)
        resp = self.client.post(
            "/api/friends/requests/",
            {"username": "bob"},
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 201)
        data = resp.json()
        self.assertEqual(data["item"]["user"]["username"], "bob")
        fs = Friendship.objects.get(from_user=self.alice, to_user=self.bob)
        self.assertEqual(fs.status, Friendship.Status.PENDING)

    def test_send_request_unauthenticated(self):
        resp = self.client.post(
            "/api/friends/requests/",
            {"username": "bob"},
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 403)

    def test_send_request_to_self(self):
        self._login(self.alice)
        resp = self.client.post(
            "/api/friends/requests/",
            {"username": "alice"},
            content_type="application/json",
        )
        self.assertIn(resp.status_code, [400, 409])

    def test_send_request_to_nonexistent_user(self):
        self._login(self.alice)
        resp = self.client.post(
            "/api/friends/requests/",
            {"username": "nobody"},
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 404)

    def test_send_duplicate_request(self):
        self._login(self.alice)
        self.client.post(
            "/api/friends/requests/",
            {"username": "bob"},
            content_type="application/json",
        )
        resp = self.client.post(
            "/api/friends/requests/",
            {"username": "bob"},
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 409)

    def test_send_request_strips_at_sign(self):
        self._login(self.alice)
        resp = self.client.post(
            "/api/friends/requests/",
            {"username": "@bob"},
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 201)

    def test_auto_accept_mutual_request(self):
        Friendship.objects.create(
            from_user=self.bob,
            to_user=self.alice,
            status=Friendship.Status.PENDING,
        )
        self._login(self.alice)
        resp = self.client.post(
            "/api/friends/requests/",
            {"username": "bob"},
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 201)
        # Both directions should be accepted
        a_to_b = Friendship.objects.get(from_user=self.alice, to_user=self.bob)
        b_to_a = Friendship.objects.get(from_user=self.bob, to_user=self.alice)
        self.assertEqual(a_to_b.status, Friendship.Status.ACCEPTED)
        self.assertEqual(b_to_a.status, Friendship.Status.ACCEPTED)


class AcceptDeclineTests(FriendsApiTestBase):
    def test_accept_request(self):
        fs = Friendship.objects.create(
            from_user=self.alice,
            to_user=self.bob,
            status=Friendship.Status.PENDING,
        )
        self._login(self.bob)
        resp = self.client.post(f"/api/friends/requests/{fs.pk}/accept/")
        self.assertEqual(resp.status_code, 200)
        fs.refresh_from_db()
        self.assertEqual(fs.status, Friendship.Status.ACCEPTED)
        # Reverse friendship created
        reverse_fs = Friendship.objects.get(from_user=self.bob, to_user=self.alice)
        self.assertEqual(reverse_fs.status, Friendship.Status.ACCEPTED)

    def test_accept_by_wrong_user(self):
        fs = Friendship.objects.create(
            from_user=self.alice,
            to_user=self.bob,
            status=Friendship.Status.PENDING,
        )
        self._login(self.charlie)
        resp = self.client.post(f"/api/friends/requests/{fs.pk}/accept/")
        self.assertEqual(resp.status_code, 403)

    def test_accept_nonexistent_request(self):
        self._login(self.bob)
        resp = self.client.post("/api/friends/requests/99999/accept/")
        self.assertEqual(resp.status_code, 404)

    def test_decline_request(self):
        fs = Friendship.objects.create(
            from_user=self.alice,
            to_user=self.bob,
            status=Friendship.Status.PENDING,
        )
        self._login(self.bob)
        resp = self.client.post(f"/api/friends/requests/{fs.pk}/decline/")
        self.assertEqual(resp.status_code, 200)
        fs.refresh_from_db()
        self.assertEqual(fs.status, Friendship.Status.DECLINED)

    def test_decline_by_wrong_user(self):
        fs = Friendship.objects.create(
            from_user=self.alice,
            to_user=self.bob,
            status=Friendship.Status.PENDING,
        )
        self._login(self.charlie)
        resp = self.client.post(f"/api/friends/requests/{fs.pk}/decline/")
        self.assertEqual(resp.status_code, 403)

    def test_re_request_after_decline(self):
        Friendship.objects.create(
            from_user=self.alice,
            to_user=self.bob,
            status=Friendship.Status.DECLINED,
        )
        self._login(self.alice)
        resp = self.client.post(
            "/api/friends/requests/",
            {"username": "bob"},
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 201)
        fs = Friendship.objects.get(from_user=self.alice, to_user=self.bob)
        self.assertEqual(fs.status, Friendship.Status.PENDING)

    def test_cancel_outgoing_request(self):
        fs = Friendship.objects.create(
            from_user=self.alice,
            to_user=self.bob,
            status=Friendship.Status.PENDING,
        )
        self._login(self.alice)
        resp = self.client.delete(f"/api/friends/requests/{fs.pk}/cancel/")
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(Friendship.objects.filter(pk=fs.pk).exists())

    def test_cancel_outgoing_request_by_other_user_forbidden(self):
        fs = Friendship.objects.create(
            from_user=self.alice,
            to_user=self.bob,
            status=Friendship.Status.PENDING,
        )
        self._login(self.charlie)
        resp = self.client.delete(f"/api/friends/requests/{fs.pk}/cancel/")
        self.assertEqual(resp.status_code, 403)

    def test_cancel_outgoing_request_returns_not_found_for_non_pending(self):
        fs = Friendship.objects.create(
            from_user=self.alice,
            to_user=self.bob,
            status=Friendship.Status.ACCEPTED,
        )
        self._login(self.alice)
        resp = self.client.delete(f"/api/friends/requests/{fs.pk}/cancel/")
        self.assertEqual(resp.status_code, 404)


class ListTests(FriendsApiTestBase):
    def test_list_friends(self):
        Friendship.objects.create(
            from_user=self.alice, to_user=self.bob, status=Friendship.Status.ACCEPTED
        )
        self._login(self.alice)
        resp = self.client.get("/api/friends/")
        self.assertEqual(resp.status_code, 200)
        items = resp.json()["items"]
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["user"]["username"], "bob")
        self.assertIn("profileImage", items[0]["user"])
        self.assertIn("avatarCrop", items[0]["user"])
        if items[0]["user"]["profileImage"] is not None:
            _assert_signed_media_url(items[0]["user"]["profileImage"])

    def test_list_friends_excludes_pending(self):
        Friendship.objects.create(
            from_user=self.alice, to_user=self.bob, status=Friendship.Status.PENDING
        )
        self._login(self.alice)
        resp = self.client.get("/api/friends/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.json()["items"]), 0)

    def test_list_incoming_requests(self):
        Friendship.objects.create(
            from_user=self.bob, to_user=self.alice, status=Friendship.Status.PENDING
        )
        self._login(self.alice)
        resp = self.client.get("/api/friends/requests/incoming/")
        self.assertEqual(resp.status_code, 200)
        items = resp.json()["items"]
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["user"]["username"], "bob")
        self.assertIn("profileImage", items[0]["user"])
        self.assertIn("avatarCrop", items[0]["user"])

    def test_list_outgoing_requests(self):
        Friendship.objects.create(
            from_user=self.alice, to_user=self.bob, status=Friendship.Status.PENDING
        )
        self._login(self.alice)
        resp = self.client.get("/api/friends/requests/outgoing/")
        self.assertEqual(resp.status_code, 200)
        items = resp.json()["items"]
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["user"]["username"], "bob")
        self.assertIn("profileImage", items[0]["user"])
        self.assertIn("avatarCrop", items[0]["user"])

    def test_list_friends_unauthenticated(self):
        resp = self.client.get("/api/friends/")
        self.assertEqual(resp.status_code, 403)

    def test_list_blocked_includes_avatar_fields(self):
        Friendship.objects.create(
            from_user=self.alice, to_user=self.bob, status=Friendship.Status.BLOCKED
        )
        self._login(self.alice)
        resp = self.client.get("/api/friends/blocked/")
        self.assertEqual(resp.status_code, 200)
        items = resp.json()["items"]
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["user"]["username"], "bob")
        self.assertIn("profileImage", items[0]["user"])
        self.assertIn("avatarCrop", items[0]["user"])


class RemoveFriendTests(FriendsApiTestBase):
    def test_remove_friend(self):
        Friendship.objects.create(
            from_user=self.alice, to_user=self.bob, status=Friendship.Status.ACCEPTED
        )
        Friendship.objects.create(
            from_user=self.bob, to_user=self.alice, status=Friendship.Status.ACCEPTED
        )
        self._login(self.alice)
        resp = self.client.delete(f"/api/friends/{self.bob.pk}/")
        self.assertEqual(resp.status_code, 204)
        self.assertFalse(
            Friendship.objects.filter(from_user=self.alice, to_user=self.bob).exists()
        )
        self.assertFalse(
            Friendship.objects.filter(from_user=self.bob, to_user=self.alice).exists()
        )

    def test_remove_nonexistent_friend(self):
        self._login(self.alice)
        resp = self.client.delete(f"/api/friends/{self.bob.pk}/")
        self.assertEqual(resp.status_code, 404)

    def test_remove_nonexistent_user(self):
        self._login(self.alice)
        resp = self.client.delete("/api/friends/99999/")
        self.assertEqual(resp.status_code, 404)

    def test_remove_friend_does_not_delete_pending_relation(self):
        Friendship.objects.create(
            from_user=self.alice, to_user=self.bob, status=Friendship.Status.PENDING
        )
        self._login(self.alice)
        resp = self.client.delete(f"/api/friends/{self.bob.pk}/")
        self.assertEqual(resp.status_code, 404)
        self.assertTrue(
            Friendship.objects.filter(
                from_user=self.alice,
                to_user=self.bob,
                status=Friendship.Status.PENDING,
            ).exists()
        )

    def test_remove_friend_does_not_delete_blocked_relation(self):
        Friendship.objects.create(
            from_user=self.alice, to_user=self.bob, status=Friendship.Status.BLOCKED
        )
        self._login(self.alice)
        resp = self.client.delete(f"/api/friends/{self.bob.pk}/")
        self.assertEqual(resp.status_code, 404)
        self.assertTrue(
            Friendship.objects.filter(
                from_user=self.alice,
                to_user=self.bob,
                status=Friendship.Status.BLOCKED,
            ).exists()
        )


class BlockUnblockTests(FriendsApiTestBase):
    def test_block_user(self):
        self._login(self.alice)
        resp = self.client.post(
            "/api/friends/block/",
            {"username": "bob"},
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 201)
        fs = Friendship.objects.get(from_user=self.alice, to_user=self.bob)
        self.assertEqual(fs.status, Friendship.Status.BLOCKED)

    def test_block_removes_reverse_friendship(self):
        Friendship.objects.create(
            from_user=self.bob, to_user=self.alice, status=Friendship.Status.ACCEPTED
        )
        self._login(self.alice)
        self.client.post(
            "/api/friends/block/",
            {"username": "bob"},
            content_type="application/json",
        )
        self.assertFalse(
            Friendship.objects.filter(
                from_user=self.bob, to_user=self.alice, status=Friendship.Status.ACCEPTED
            ).exists()
        )

    def test_block_self(self):
        self._login(self.alice)
        resp = self.client.post(
            "/api/friends/block/",
            {"username": "alice"},
            content_type="application/json",
        )
        self.assertIn(resp.status_code, [400, 409])

    def test_unblock_user(self):
        Friendship.objects.create(
            from_user=self.alice, to_user=self.bob, status=Friendship.Status.BLOCKED
        )
        self._login(self.alice)
        resp = self.client.delete(f"/api/friends/block/{self.bob.pk}/")
        self.assertEqual(resp.status_code, 204)
        self.assertFalse(
            Friendship.objects.filter(from_user=self.alice, to_user=self.bob).exists()
        )

    def test_unblock_when_not_blocked(self):
        self._login(self.alice)
        resp = self.client.delete(f"/api/friends/block/{self.bob.pk}/")
        self.assertEqual(resp.status_code, 404)

    def test_cannot_send_request_to_blocked_user(self):
        Friendship.objects.create(
            from_user=self.alice, to_user=self.bob, status=Friendship.Status.BLOCKED
        )
        self._login(self.alice)
        resp = self.client.post(
            "/api/friends/requests/",
            {"username": "bob"},
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 409)

    def test_cannot_send_request_to_user_who_blocked_you(self):
        Friendship.objects.create(
            from_user=self.bob, to_user=self.alice, status=Friendship.Status.BLOCKED
        )
        self._login(self.alice)
        resp = self.client.post(
            "/api/friends/requests/",
            {"username": "bob"},
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 409)
