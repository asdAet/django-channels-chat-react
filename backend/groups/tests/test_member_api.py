"""Tests for group member management API endpoints."""

from urllib.parse import parse_qs, urlparse

import pytest
from django.contrib.auth import get_user_model
from django.test import TestCase

from roles.models import Membership, Role
from rooms.models import Room
from users.identity import user_public_id

from ._typing import TypedAPIClient

User = get_user_model()


class APITestCase(TestCase):
    api_client: TypedAPIClient


def _assert_signed_media_url(url: str):
    parsed = urlparse(url)
    assert parsed.path.startswith("/api/auth/media/")
    query = parse_qs(parsed.query)
    assert "exp" in query
    assert "sig" in query


def _create_group_with_member(client: TypedAPIClient, owner, member) -> int:
    """Helper: create group, invite link, join via link, return room id."""
    client.force_authenticate(user=owner)
    resp = client.post("/api/groups/", {"name": "Test Group"}, format="json")
    room_id = int(resp.json()["roomId"])

    resp = client.post(f"/api/groups/{room_id}/invites/", {}, format="json")
    code = resp.json()["code"]

    client.force_authenticate(user=member)
    client.post(f"/api/invite/{code}/join/")

    client.force_authenticate(user=owner)
    return room_id


@pytest.mark.django_db
class TestJoinLeave(APITestCase):
    def setUp(self):
        self.api_client = TypedAPIClient()
        self.owner = User.objects.create_user(username="owner", password="testpass123")
        self.member = User.objects.create_user(username="member", password="testpass123")

    def test_join_public_group(self):
        self.api_client.force_authenticate(user=self.owner)
        resp = self.api_client.post(
            "/api/groups/",
            {"name": "Public", "isPublic": True, "username": "pubgrp"},
            format="json",
        )
        room_id = int(resp.json()["roomId"])

        self.api_client.force_authenticate(user=self.member)
        resp = self.api_client.post(f"/api/groups/{room_id}/join/")
        assert resp.status_code == 200

    def test_join_private_group_rejected(self):
        self.api_client.force_authenticate(user=self.owner)
        resp = self.api_client.post("/api/groups/", {"name": "Private"}, format="json")
        room_id = int(resp.json()["roomId"])

        self.api_client.force_authenticate(user=self.member)
        resp = self.api_client.post(f"/api/groups/{room_id}/join/")
        assert resp.status_code == 403

    def test_leave_group(self):
        room_id = _create_group_with_member(self.api_client, self.owner, self.member)

        self.api_client.force_authenticate(user=self.member)
        resp = self.api_client.post(f"/api/groups/{room_id}/leave/")
        assert resp.status_code == 204

        assert not Membership.objects.filter(room_id=room_id, user=self.member).exists()

    def test_owner_cannot_leave(self):
        self.api_client.force_authenticate(user=self.owner)
        resp = self.api_client.post("/api/groups/", {"name": "Test"}, format="json")
        room_id = int(resp.json()["roomId"])

        resp = self.api_client.post(f"/api/groups/{room_id}/leave/")
        assert resp.status_code == 400


@pytest.mark.django_db
class TestKickBanMute(APITestCase):
    def setUp(self):
        self.api_client = TypedAPIClient()
        self.owner = User.objects.create_user(username="owner", password="testpass123")
        self.member = User.objects.create_user(username="member", password="testpass123")
        self.other = User.objects.create_user(username="other", password="testpass123")
        self.room_id = _create_group_with_member(self.api_client, self.owner, self.member)

    def test_kick_member(self):
        self.api_client.force_authenticate(user=self.owner)
        resp = self.api_client.delete(f"/api/groups/{self.room_id}/members/{self.member.pk}/")
        assert resp.status_code == 204
        assert not Membership.objects.filter(
            room_id=self.room_id, user=self.member, is_banned=False
        ).exists()

    def test_kick_requires_permission(self):
        self.api_client.force_authenticate(user=self.member)
        resp = self.api_client.delete(f"/api/groups/{self.room_id}/members/{self.owner.pk}/")
        assert resp.status_code == 403

    def test_kick_self_returns_400(self):
        self.api_client.force_authenticate(user=self.owner)
        resp = self.api_client.delete(f"/api/groups/{self.room_id}/members/{self.owner.pk}/")
        assert resp.status_code == 400

    def test_ban_member(self):
        self.api_client.force_authenticate(user=self.owner)
        resp = self.api_client.post(
            f"/api/groups/{self.room_id}/members/{self.member.pk}/ban/",
            {"reason": "spam"},
            format="json",
        )
        assert resp.status_code == 204

        membership = Membership.objects.get(room_id=self.room_id, user=self.member)
        assert membership.is_banned is True
        assert membership.ban_reason == "spam"

    def test_ban_self_returns_400(self):
        self.api_client.force_authenticate(user=self.owner)
        resp = self.api_client.post(
            f"/api/groups/{self.room_id}/members/{self.owner.pk}/ban/",
            {"reason": "self"},
            format="json",
        )
        assert resp.status_code == 400

    def test_unban_member(self):
        self.api_client.force_authenticate(user=self.owner)
        self.api_client.post(
            f"/api/groups/{self.room_id}/members/{self.member.pk}/ban/",
            {"reason": "test"},
            format="json",
        )
        resp = self.api_client.post(f"/api/groups/{self.room_id}/members/{self.member.pk}/unban/")
        assert resp.status_code == 204

        assert not Membership.objects.filter(room_id=self.room_id, user=self.member).exists()

    def test_member_can_rejoin_after_unban_via_invite(self):
        self.api_client.force_authenticate(user=self.owner)
        self.api_client.post(
            f"/api/groups/{self.room_id}/members/{self.member.pk}/ban/",
            {"reason": "test"},
            format="json",
        )
        self.api_client.post(f"/api/groups/{self.room_id}/members/{self.member.pk}/unban/")
        invite_response = self.api_client.post(
            f"/api/groups/{self.room_id}/invites/", {}, format="json"
        )
        code = invite_response.json()["code"]

        self.api_client.force_authenticate(user=self.member)
        resp = self.api_client.post(f"/api/invite/{code}/join/")
        assert resp.status_code == 200
        assert Membership.objects.filter(
            room_id=self.room_id, user=self.member, is_banned=False
        ).exists()

    def test_kicked_member_loses_access_to_members_api(self):
        self.api_client.force_authenticate(user=self.owner)
        self.api_client.delete(f"/api/groups/{self.room_id}/members/{self.member.pk}/")

        self.api_client.force_authenticate(user=self.member)
        resp = self.api_client.get(f"/api/groups/{self.room_id}/members/")
        assert resp.status_code == 403

    def test_banned_member_loses_access_to_members_api(self):
        self.api_client.force_authenticate(user=self.owner)
        self.api_client.post(
            f"/api/groups/{self.room_id}/members/{self.member.pk}/ban/",
            {"reason": "test"},
            format="json",
        )

        self.api_client.force_authenticate(user=self.member)
        resp = self.api_client.get(f"/api/groups/{self.room_id}/members/")
        assert resp.status_code == 403

    def test_mute_member(self):
        self.api_client.force_authenticate(user=self.owner)
        resp = self.api_client.post(
            f"/api/groups/{self.room_id}/members/{self.member.pk}/mute/",
            {"durationSeconds": 3600},
            format="json",
        )
        assert resp.status_code == 204

        membership = Membership.objects.get(room_id=self.room_id, user=self.member)
        assert membership.is_muted is True

    def test_mute_self_returns_400(self):
        self.api_client.force_authenticate(user=self.owner)
        resp = self.api_client.post(
            f"/api/groups/{self.room_id}/members/{self.owner.pk}/mute/",
            {"durationSeconds": 3600},
            format="json",
        )
        assert resp.status_code == 400

    def test_unmute_member(self):
        self.api_client.force_authenticate(user=self.owner)
        self.api_client.post(
            f"/api/groups/{self.room_id}/members/{self.member.pk}/mute/",
            {"durationSeconds": 3600},
            format="json",
        )
        resp = self.api_client.post(f"/api/groups/{self.room_id}/members/{self.member.pk}/unmute/")
        assert resp.status_code == 204

        membership = Membership.objects.get(room_id=self.room_id, user=self.member)
        assert membership.is_muted is False

    def test_unmute_self_returns_400(self):
        self.api_client.force_authenticate(user=self.owner)
        resp = self.api_client.post(f"/api/groups/{self.room_id}/members/{self.owner.pk}/unmute/")
        assert resp.status_code == 400

    def test_list_members(self):
        self.api_client.force_authenticate(user=self.owner)
        resp = self.api_client.get(f"/api/groups/{self.room_id}/members/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 2
        assert len(data["items"]) == 2
        assert data["pagination"]["limit"] == 50
        assert data["pagination"]["hasMore"] is False
        assert data["pagination"]["nextBefore"] is None
        assert "nickname" in data["items"][0]
        by_user = {item["userId"]: item for item in data["items"]}
        assert by_user[self.owner.pk]["isSelf"] is True
        assert by_user[self.member.pk]["isSelf"] is False
        if data["items"][0]["profileImage"] is not None:
            _assert_signed_media_url(data["items"][0]["profileImage"])

    def test_list_members_cursor_pagination_by_id(self):
        self.api_client.force_authenticate(user=self.owner)
        first = self.api_client.get(f"/api/groups/{self.room_id}/members/?limit=1")
        assert first.status_code == 200
        first_payload = first.json()
        assert first_payload["pagination"]["limit"] == 1
        assert first_payload["pagination"]["hasMore"] is True
        assert first_payload["pagination"]["nextBefore"] is not None
        first_user_id = int(first_payload["items"][0]["userId"])

        second = self.api_client.get(
            f"/api/groups/{self.room_id}/members/?limit=1&before={first_payload['pagination']['nextBefore']}"
        )
        assert second.status_code == 200
        second_payload = second.json()
        assert len(second_payload["items"]) == 1
        assert int(second_payload["items"][0]["userId"]) != first_user_id

    def test_list_banned(self):
        self.api_client.force_authenticate(user=self.owner)
        self.api_client.post(
            f"/api/groups/{self.room_id}/members/{self.member.pk}/ban/",
            {"reason": "test"},
            format="json",
        )
        resp = self.api_client.get(f"/api/groups/{self.room_id}/banned/")
        assert resp.status_code == 200
        payload = resp.json()
        items = payload["items"]
        assert payload["pagination"]["limit"] == 50
        assert payload["pagination"]["hasMore"] is False
        assert payload["pagination"]["nextBefore"] is None
        assert len(items) == 1
        assert items[0]["username"] == user_public_id(self.member)

    def test_hierarchy_prevents_kicking_higher_role(self):
        """A member with Admin role should not be kickable by a Moderator."""
        room = Room.objects.get(pk=self.room_id)

        admin_role = Role.objects.get(room=room, name="Admin")
        mod_role = Role.objects.get(room=room, name="Moderator")

        mod = User.objects.create_user(username="mod", password="testpass123")
        self.api_client.force_authenticate(user=self.owner)
        resp = self.api_client.post(f"/api/groups/{self.room_id}/invites/", {}, format="json")
        code = resp.json()["code"]
        self.api_client.force_authenticate(user=mod)
        self.api_client.post(f"/api/invite/{code}/join/")

        member_ms = Membership.objects.get(room=room, user=self.member)
        member_ms.roles.add(admin_role)
        mod_ms = Membership.objects.get(room=room, user=mod)
        mod_ms.roles.add(mod_role)

        self.api_client.force_authenticate(user=mod)
        resp = self.api_client.delete(f"/api/groups/{self.room_id}/members/{self.member.pk}/")
        assert resp.status_code == 403
