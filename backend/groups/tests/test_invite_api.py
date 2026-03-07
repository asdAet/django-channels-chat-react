"""Tests for invite link API endpoints."""

import pytest
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from groups.infrastructure.models import InviteLink
from rooms.models import Room

from ._typing import TypedAPIClient

User = get_user_model()


class APITestCase(TestCase):
    api_client: TypedAPIClient


@pytest.mark.django_db
class TestInviteLinks(APITestCase):
    def setUp(self):
        self.api_client = TypedAPIClient()
        self.owner = User.objects.create_user(username="owner", password="testpass123")
        self.joiner = User.objects.create_user(username="joiner", password="testpass123")
        self.api_client.force_authenticate(user=self.owner)

        resp = self.api_client.post("/api/groups/", {"name": "Invite Group"}, format="json")
        self.slug = resp.json()["slug"]

    def test_create_invite(self):
        resp = self.api_client.post(
            f"/api/groups/{self.slug}/invites/",
            {"name": "General"},
            format="json",
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["code"]
        assert data["name"] == "General"
        assert data["isExpired"] is False

    def test_create_invite_with_expiry(self):
        resp = self.api_client.post(
            f"/api/groups/{self.slug}/invites/",
            {"expiresInSeconds": 3600, "maxUses": 10},
            format="json",
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["maxUses"] == 10
        assert data["expiresAt"] is not None

    def test_join_via_invite(self):
        resp = self.api_client.post(
            f"/api/groups/{self.slug}/invites/", {}, format="json"
        )
        code = resp.json()["code"]

        self.api_client.force_authenticate(user=self.joiner)
        resp = self.api_client.post(f"/api/invite/{code}/join/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "joined"
        assert data["roomSlug"] == self.slug

    def test_invite_preview(self):
        resp = self.api_client.post(
            f"/api/groups/{self.slug}/invites/", {}, format="json"
        )
        code = resp.json()["code"]

        self.api_client.force_authenticate(user=None)
        resp = self.api_client.get(f"/api/invite/{code}/")
        assert resp.status_code == 200
        assert resp.json()["groupName"] == "Invite Group"

    def test_revoke_invite(self):
        resp = self.api_client.post(
            f"/api/groups/{self.slug}/invites/", {}, format="json"
        )
        code = resp.json()["code"]

        resp = self.api_client.delete(f"/api/groups/{self.slug}/invites/{code}/")
        assert resp.status_code == 204

        invite = InviteLink.objects.get(code=code)
        assert invite.is_revoked is True

        # Trying to join via revoked link
        self.api_client.force_authenticate(user=self.joiner)
        resp = self.api_client.post(f"/api/invite/{code}/join/")
        assert resp.status_code == 400

    def test_expired_invite_rejected(self):
        resp = self.api_client.post(
            f"/api/groups/{self.slug}/invites/", {}, format="json"
        )
        code = resp.json()["code"]

        # Manually expire the invite
        invite = InviteLink.objects.get(code=code)
        invite.expires_at = timezone.now() - timezone.timedelta(hours=1)
        invite.save(update_fields=["expires_at"])

        self.api_client.force_authenticate(user=self.joiner)
        resp = self.api_client.post(f"/api/invite/{code}/join/")
        assert resp.status_code == 400

    def test_max_uses_enforced(self):
        resp = self.api_client.post(
            f"/api/groups/{self.slug}/invites/",
            {"maxUses": 1},
            format="json",
        )
        code = resp.json()["code"]

        self.api_client.force_authenticate(user=self.joiner)
        resp = self.api_client.post(f"/api/invite/{code}/join/")
        assert resp.status_code == 200

        user3 = User.objects.create_user(username="user3", password="testpass123")
        self.api_client.force_authenticate(user=user3)
        resp = self.api_client.post(f"/api/invite/{code}/join/")
        assert resp.status_code == 400

    def test_banned_user_cannot_join(self):
        # Create invite and join
        resp = self.api_client.post(
            f"/api/groups/{self.slug}/invites/", {}, format="json"
        )
        code = resp.json()["code"]

        self.api_client.force_authenticate(user=self.joiner)
        self.api_client.post(f"/api/invite/{code}/join/")

        # Ban the joiner
        self.api_client.force_authenticate(user=self.owner)
        self.api_client.post(
            f"/api/groups/{self.slug}/members/{self.joiner.pk}/ban/",
            {"reason": "test"},
            format="json",
        )

        # Create new invite and try to join again
        resp = self.api_client.post(
            f"/api/groups/{self.slug}/invites/", {}, format="json"
        )
        code2 = resp.json()["code"]

        self.api_client.force_authenticate(user=self.joiner)
        resp = self.api_client.post(f"/api/invite/{code2}/join/")
        assert resp.status_code == 403

    def test_list_invites_requires_manage_invites(self):
        self.api_client.force_authenticate(user=self.joiner)
        resp = self.api_client.get(f"/api/groups/{self.slug}/invites/")
        assert resp.status_code == 403
