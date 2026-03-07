"""Tests for pinned messages and ownership transfer API endpoints."""

import pytest
from django.contrib.auth import get_user_model
from django.test import TestCase

from messages.models import Message
from roles.models import Membership, Role
from rooms.models import Room

from ._typing import TypedAPIClient

User = get_user_model()


class APITestCase(TestCase):
    api_client: TypedAPIClient


def _setup_group_with_message(client: TypedAPIClient, owner):
    """Create a group and a message inside it, return (slug, message_id)."""
    client.force_authenticate(user=owner)
    resp = client.post("/api/groups/", {"name": "Pin Group"}, format="json")
    slug = resp.json()["slug"]
    room = Room.objects.get(slug=slug)
    msg = Message.objects.create(
        room=room, user=owner, username=owner.username, message_content="Hello!"
    )
    return slug, msg.pk


@pytest.mark.django_db
class TestPinnedMessages(APITestCase):
    def setUp(self):
        self.api_client = TypedAPIClient()
        self.owner = User.objects.create_user(username="owner", password="testpass123")
        self.member = User.objects.create_user(username="member", password="testpass123")
        self.slug, self.msg_id = _setup_group_with_message(self.api_client, self.owner)

    def test_pin_message(self):
        resp = self.api_client.post(
            f"/api/groups/{self.slug}/pins/",
            {"messageId": self.msg_id},
            format="json",
        )
        assert resp.status_code == 201
        assert resp.json()["messageId"] == self.msg_id

    def test_list_pinned(self):
        self.api_client.post(
            f"/api/groups/{self.slug}/pins/",
            {"messageId": self.msg_id},
            format="json",
        )
        resp = self.api_client.get(f"/api/groups/{self.slug}/pins/")
        assert resp.status_code == 200
        items = resp.json()["items"]
        assert len(items) == 1
        assert items[0]["content"] == "Hello!"

    def test_unpin_message(self):
        self.api_client.post(
            f"/api/groups/{self.slug}/pins/",
            {"messageId": self.msg_id},
            format="json",
        )
        resp = self.api_client.delete(f"/api/groups/{self.slug}/pins/{self.msg_id}/")
        assert resp.status_code == 204

        resp = self.api_client.get(f"/api/groups/{self.slug}/pins/")
        assert len(resp.json()["items"]) == 0

    def test_pin_requires_permission(self):
        self.api_client.force_authenticate(user=self.member)
        resp = self.api_client.post(
            f"/api/groups/{self.slug}/pins/",
            {"messageId": self.msg_id},
            format="json",
        )
        assert resp.status_code == 403

    def test_pin_nonexistent_message(self):
        resp = self.api_client.post(
            f"/api/groups/{self.slug}/pins/",
            {"messageId": 99999},
            format="json",
        )
        assert resp.status_code == 404


@pytest.mark.django_db
class TestOwnershipTransfer(APITestCase):
    def setUp(self):
        self.api_client = TypedAPIClient()
        self.owner = User.objects.create_user(username="owner", password="testpass123")
        self.member = User.objects.create_user(username="member", password="testpass123")
        self.api_client.force_authenticate(user=self.owner)

        resp = self.api_client.post("/api/groups/", {"name": "Transfer Group"}, format="json")
        self.slug = resp.json()["slug"]

        # Add member via invite
        resp = self.api_client.post(f"/api/groups/{self.slug}/invites/", {}, format="json")
        code = resp.json()["code"]
        self.api_client.force_authenticate(user=self.member)
        self.api_client.post(f"/api/invite/{code}/join/")
        self.api_client.force_authenticate(user=self.owner)

    def test_transfer_ownership(self):
        resp = self.api_client.post(
            f"/api/groups/{self.slug}/transfer-ownership/",
            {"userId": self.member.pk},
            format="json",
        )
        assert resp.status_code == 200

        room = Room.objects.get(slug=self.slug)
        assert room.created_by_id == self.member.pk

        # Old owner should have Admin role, not Owner
        owner_ms = Membership.objects.get(room=room, user=self.owner)
        role_names = set(owner_ms.roles.values_list("name", flat=True))
        assert "Owner" not in role_names
        assert "Admin" in role_names

        # New owner should have Owner role
        member_ms = Membership.objects.get(room=room, user=self.member)
        role_names = set(member_ms.roles.values_list("name", flat=True))
        assert "Owner" in role_names

    def test_transfer_to_self_fails(self):
        resp = self.api_client.post(
            f"/api/groups/{self.slug}/transfer-ownership/",
            {"userId": self.owner.pk},
            format="json",
        )
        assert resp.status_code == 400

    def test_non_owner_cannot_transfer(self):
        self.api_client.force_authenticate(user=self.member)
        resp = self.api_client.post(
            f"/api/groups/{self.slug}/transfer-ownership/",
            {"userId": self.owner.pk},
            format="json",
        )
        assert resp.status_code == 403

    def test_owner_can_leave_after_transfer(self):
        self.api_client.post(
            f"/api/groups/{self.slug}/transfer-ownership/",
            {"userId": self.member.pk},
            format="json",
        )
        resp = self.api_client.post(f"/api/groups/{self.slug}/leave/")
        assert resp.status_code == 204
