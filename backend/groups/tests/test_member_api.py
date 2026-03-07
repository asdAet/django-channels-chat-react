"""Tests for group member management API endpoints."""

import pytest
from django.contrib.auth import get_user_model
from django.test import TestCase

from roles.models import Membership, Role
from rooms.models import Room

from ._typing import TypedAPIClient

User = get_user_model()


class APITestCase(TestCase):
    api_client: TypedAPIClient


def _create_group_with_member(client: TypedAPIClient, owner, member):
    """Helper: create group, invite link, join via link, return slug."""
    client.force_authenticate(user=owner)
    resp = client.post("/api/groups/", {"name": "Test Group"}, format="json")
    slug = resp.json()["slug"]

    resp = client.post(f"/api/groups/{slug}/invites/", {}, format="json")
    code = resp.json()["code"]

    client.force_authenticate(user=member)
    client.post(f"/api/invite/{code}/join/")

    client.force_authenticate(user=owner)
    return slug


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
        slug = resp.json()["slug"]

        self.api_client.force_authenticate(user=self.member)
        resp = self.api_client.post(f"/api/groups/{slug}/join/")
        assert resp.status_code == 200

    def test_join_private_group_rejected(self):
        self.api_client.force_authenticate(user=self.owner)
        resp = self.api_client.post("/api/groups/", {"name": "Private"}, format="json")
        slug = resp.json()["slug"]

        self.api_client.force_authenticate(user=self.member)
        resp = self.api_client.post(f"/api/groups/{slug}/join/")
        assert resp.status_code == 403

    def test_leave_group(self):
        slug = _create_group_with_member(self.api_client, self.owner, self.member)

        self.api_client.force_authenticate(user=self.member)
        resp = self.api_client.post(f"/api/groups/{slug}/leave/")
        assert resp.status_code == 204

        assert not Membership.objects.filter(
            room__slug=slug, user=self.member
        ).exists()

    def test_owner_cannot_leave(self):
        self.api_client.force_authenticate(user=self.owner)
        resp = self.api_client.post("/api/groups/", {"name": "Test"}, format="json")
        slug = resp.json()["slug"]

        resp = self.api_client.post(f"/api/groups/{slug}/leave/")
        assert resp.status_code == 400


@pytest.mark.django_db
class TestKickBanMute(APITestCase):
    def setUp(self):
        self.api_client = TypedAPIClient()
        self.owner = User.objects.create_user(username="owner", password="testpass123")
        self.member = User.objects.create_user(username="member", password="testpass123")
        self.other = User.objects.create_user(username="other", password="testpass123")
        self.slug = _create_group_with_member(self.api_client, self.owner, self.member)

    def test_kick_member(self):
        self.api_client.force_authenticate(user=self.owner)
        resp = self.api_client.delete(
            f"/api/groups/{self.slug}/members/{self.member.pk}/"
        )
        assert resp.status_code == 204
        assert not Membership.objects.filter(
            room__slug=self.slug, user=self.member, is_banned=False
        ).exists()

    def test_kick_requires_permission(self):
        self.api_client.force_authenticate(user=self.member)
        resp = self.api_client.delete(
            f"/api/groups/{self.slug}/members/{self.owner.pk}/"
        )
        assert resp.status_code == 403

    def test_ban_member(self):
        self.api_client.force_authenticate(user=self.owner)
        resp = self.api_client.post(
            f"/api/groups/{self.slug}/members/{self.member.pk}/ban/",
            {"reason": "spam"},
            format="json",
        )
        assert resp.status_code == 204

        membership = Membership.objects.get(
            room__slug=self.slug, user=self.member
        )
        assert membership.is_banned is True
        assert membership.ban_reason == "spam"

    def test_unban_member(self):
        self.api_client.force_authenticate(user=self.owner)
        self.api_client.post(
            f"/api/groups/{self.slug}/members/{self.member.pk}/ban/",
            {"reason": "test"},
            format="json",
        )
        resp = self.api_client.post(
            f"/api/groups/{self.slug}/members/{self.member.pk}/unban/"
        )
        assert resp.status_code == 204

        membership = Membership.objects.get(
            room__slug=self.slug, user=self.member
        )
        assert membership.is_banned is False

    def test_mute_member(self):
        self.api_client.force_authenticate(user=self.owner)
        resp = self.api_client.post(
            f"/api/groups/{self.slug}/members/{self.member.pk}/mute/",
            {"durationSeconds": 3600},
            format="json",
        )
        assert resp.status_code == 204

        membership = Membership.objects.get(
            room__slug=self.slug, user=self.member
        )
        assert membership.is_muted is True

    def test_unmute_member(self):
        self.api_client.force_authenticate(user=self.owner)
        self.api_client.post(
            f"/api/groups/{self.slug}/members/{self.member.pk}/mute/",
            {"durationSeconds": 3600},
            format="json",
        )
        resp = self.api_client.post(
            f"/api/groups/{self.slug}/members/{self.member.pk}/unmute/"
        )
        assert resp.status_code == 204

        membership = Membership.objects.get(
            room__slug=self.slug, user=self.member
        )
        assert membership.is_muted is False

    def test_list_members(self):
        self.api_client.force_authenticate(user=self.owner)
        resp = self.api_client.get(f"/api/groups/{self.slug}/members/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 2

    def test_list_banned(self):
        self.api_client.force_authenticate(user=self.owner)
        self.api_client.post(
            f"/api/groups/{self.slug}/members/{self.member.pk}/ban/",
            {"reason": "test"},
            format="json",
        )
        resp = self.api_client.get(f"/api/groups/{self.slug}/banned/")
        assert resp.status_code == 200
        items = resp.json()["items"]
        assert len(items) == 1
        assert items[0]["username"] == "member"

    def test_hierarchy_prevents_kicking_higher_role(self):
        """A member with Admin role should not be kickable by a Moderator."""
        slug = self.slug
        room = Room.objects.get(slug=slug)

        # Give member the Admin role
        admin_role = Role.objects.get(room=room, name="Admin")
        mod_role = Role.objects.get(room=room, name="Moderator")

        mod = User.objects.create_user(username="mod", password="testpass123")
        # Join mod to group
        self.api_client.force_authenticate(user=self.owner)
        resp = self.api_client.post(f"/api/groups/{slug}/invites/", {}, format="json")
        code = resp.json()["code"]
        self.api_client.force_authenticate(user=mod)
        self.api_client.post(f"/api/invite/{code}/join/")

        # Assign roles
        member_ms = Membership.objects.get(room=room, user=self.member)
        member_ms.roles.add(admin_role)
        mod_ms = Membership.objects.get(room=room, user=mod)
        mod_ms.roles.add(mod_role)

        # Mod tries to kick Admin — should fail
        self.api_client.force_authenticate(user=mod)
        resp = self.api_client.delete(f"/api/groups/{slug}/members/{self.member.pk}/")
        assert resp.status_code == 403
