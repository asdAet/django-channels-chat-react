"""Tests for group CRUD API endpoints."""

import pytest
from django.contrib.auth import get_user_model
from django.test import TestCase

from rooms.models import Room

from ._typing import TypedAPIClient

User = get_user_model()


class APITestCase(TestCase):
    api_client: TypedAPIClient


@pytest.mark.django_db
class TestCreateGroup(APITestCase):
    def setUp(self):
        self.api_client = TypedAPIClient()
        self.user = User.objects.create_user(username="owner", password="testpass123")
        self.api_client.force_authenticate(user=self.user)

    def test_create_private_group(self):
        resp = self.api_client.post("/api/groups/", {"name": "My Group"}, format="json")
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "My Group"
        assert data["isPublic"] is False
        assert data["memberCount"] == 1
        assert data["createdBy"] == "owner"

        room = Room.objects.get(slug=data["slug"])
        assert room.kind == Room.Kind.GROUP
        assert room.member_count == 1

    def test_create_public_group_requires_username(self):
        resp = self.api_client.post(
            "/api/groups/",
            {"name": "Public Group", "isPublic": True},
            format="json",
        )
        assert resp.status_code == 400

    def test_create_public_group_with_username(self):
        resp = self.api_client.post(
            "/api/groups/",
            {"name": "Public Group", "isPublic": True, "username": "pubgroup"},
            format="json",
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["isPublic"] is True
        assert data["username"] == "pubgroup"

    def test_create_group_unauthenticated(self):
        self.api_client.force_authenticate(user=None)
        resp = self.api_client.post("/api/groups/", {"name": "Test"}, format="json")
        assert resp.status_code == 403

    def test_duplicate_username_rejected(self):
        self.api_client.post(
            "/api/groups/",
            {"name": "G1", "isPublic": True, "username": "unique1"},
            format="json",
        )
        resp = self.api_client.post(
            "/api/groups/",
            {"name": "G2", "isPublic": True, "username": "unique1"},
            format="json",
        )
        assert resp.status_code == 409


@pytest.mark.django_db
class TestGroupDetail(APITestCase):
    def setUp(self):
        self.api_client = TypedAPIClient()
        self.owner = User.objects.create_user(username="owner", password="testpass123")
        self.other = User.objects.create_user(username="other", password="testpass123")
        self.api_client.force_authenticate(user=self.owner)

        resp = self.api_client.post(
            "/api/groups/",
            {"name": "Test Group", "isPublic": True, "username": "testgrp"},
            format="json",
        )
        self.slug = resp.json()["slug"]

    def test_get_public_group_info_unauthenticated(self):
        self.api_client.force_authenticate(user=None)
        resp = self.api_client.get(f"/api/groups/{self.slug}/")
        assert resp.status_code == 200
        assert resp.json()["name"] == "Test Group"

    def test_update_group(self):
        resp = self.api_client.patch(
            f"/api/groups/{self.slug}/",
            {"description": "Updated desc", "slowModeSeconds": 30},
            format="json",
        )
        assert resp.status_code == 200
        assert resp.json()["slowModeSeconds"] == 30

    def test_update_group_forbidden_for_non_admin(self):
        self.api_client.force_authenticate(user=self.other)
        resp = self.api_client.patch(
            f"/api/groups/{self.slug}/",
            {"name": "Hacked"},
            format="json",
        )
        assert resp.status_code == 403

    def test_delete_group(self):
        resp = self.api_client.delete(f"/api/groups/{self.slug}/")
        assert resp.status_code == 204
        assert not Room.objects.filter(slug=self.slug).exists()

    def test_delete_group_forbidden_for_non_owner(self):
        self.api_client.force_authenticate(user=self.other)
        resp = self.api_client.delete(f"/api/groups/{self.slug}/")
        assert resp.status_code == 403


@pytest.mark.django_db
class TestPublicGroupList(APITestCase):
    def setUp(self):
        self.api_client = TypedAPIClient()
        self.user = User.objects.create_user(username="owner", password="testpass123")
        self.api_client.force_authenticate(user=self.user)

        for i in range(3):
            self.api_client.post(
                "/api/groups/",
                {"name": f"Group {i}", "isPublic": True, "username": f"grp{i}"},
                format="json",
            )
        self.api_client.post("/api/groups/", {"name": "Private Group"}, format="json")

    def test_list_public_groups(self):
        self.api_client.force_authenticate(user=None)
        resp = self.api_client.get("/api/groups/public/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 3
        assert len(data["items"]) == 3

    def test_search_public_groups(self):
        self.api_client.force_authenticate(user=None)
        resp = self.api_client.get("/api/groups/public/?search=grp1")
        assert resp.status_code == 200
        assert resp.json()["total"] == 1


@pytest.mark.django_db
class TestPrivateGroupAccess(APITestCase):
    def setUp(self):
        self.api_client = TypedAPIClient()
        self.owner = User.objects.create_user(username="owner", password="testpass123")
        self.other = User.objects.create_user(username="other", password="testpass123")
        self.api_client.force_authenticate(user=self.owner)

        resp = self.api_client.post("/api/groups/", {"name": "Secret Group"}, format="json")
        self.slug = resp.json()["slug"]

    def test_private_group_hidden_from_non_member(self):
        self.api_client.force_authenticate(user=self.other)
        resp = self.api_client.get(f"/api/groups/{self.slug}/")
        assert resp.status_code == 404

    def test_private_group_hidden_from_unauthenticated(self):
        self.api_client.force_authenticate(user=None)
        resp = self.api_client.get(f"/api/groups/{self.slug}/")
        assert resp.status_code == 404
