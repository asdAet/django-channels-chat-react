"""Tests for group CRUD API endpoints."""

from urllib.parse import parse_qs, urlparse

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase

from rooms.models import Room
from users.identity import user_public_username

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
        assert data["createdBy"] == user_public_username(self.user)
        assert data["avatarUrl"] is not None
        _assert_signed_media_url(data["avatarUrl"])
        assert data["avatarCrop"] is None

        room = Room.objects.get(pk=int(data["roomId"]))
        assert room.kind == Room.Kind.GROUP
        assert room.member_count == 1

    def test_create_public_group_without_username_is_rejected(self):
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
        self.room_id = resp.json()["roomId"]

    def test_get_public_group_info_unauthenticated(self):
        self.api_client.force_authenticate(user=None)
        resp = self.api_client.get(f"/api/groups/{self.room_id}/")
        assert resp.status_code == 200
        assert resp.json()["name"] == "Test Group"

    def test_update_group(self):
        resp = self.api_client.patch(
            f"/api/groups/{self.room_id}/",
            {"description": "Updated desc", "slowModeSeconds": 30},
            format="json",
        )
        assert resp.status_code == 200
        assert resp.json()["slowModeSeconds"] == 30

    def test_update_public_group_rejects_empty_username(self):
        resp = self.api_client.patch(
            f"/api/groups/{self.room_id}/",
            {"username": ""},
            format="json",
        )
        assert resp.status_code == 400

    def test_update_group_rejects_duplicate_username(self):
        other = self.api_client.post(
            "/api/groups/",
            {"name": "Other", "isPublic": True, "username": "taken_group"},
            format="json",
        )
        assert other.status_code == 201

        resp = self.api_client.patch(
            f"/api/groups/{self.room_id}/",
            {"username": "taken_group"},
            format="json",
        )
        assert resp.status_code == 409

    def test_update_group_forbidden_for_non_admin(self):
        self.api_client.force_authenticate(user=self.other)
        resp = self.api_client.patch(
            f"/api/groups/{self.room_id}/",
            {"name": "Hacked"},
            format="json",
        )
        assert resp.status_code == 403

    def test_delete_group(self):
        resp = self.api_client.delete(f"/api/groups/{self.room_id}/")
        assert resp.status_code == 204
        assert not Room.objects.filter(pk=int(self.room_id)).exists()

    def test_delete_group_forbidden_for_non_owner(self):
        self.api_client.force_authenticate(user=self.other)
        resp = self.api_client.delete(f"/api/groups/{self.room_id}/")
        assert resp.status_code == 403

    def test_update_group_avatar_with_multipart_patch(self):
        avatar = SimpleUploadedFile("avatar.png", b"fake-image-content", content_type="image/png")
        resp = self.api_client.patch(
            f"/api/groups/{self.room_id}/",
            {"avatar": avatar},
            format="multipart",
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["avatarUrl"] is not None
        _assert_signed_media_url(data["avatarUrl"])
        assert data["avatarCrop"] is None

    def test_update_group_avatar_crop_persists(self):
        avatar = SimpleUploadedFile("avatar.png", b"fake-image-content", content_type="image/png")
        set_resp = self.api_client.patch(
            f"/api/groups/{self.room_id}/",
            {"avatar": avatar},
            format="multipart",
        )
        assert set_resp.status_code == 200

        crop_resp = self.api_client.patch(
            f"/api/groups/{self.room_id}/",
            {
                "avatarCropX": 0.1,
                "avatarCropY": 0.2,
                "avatarCropWidth": 0.3,
                "avatarCropHeight": 0.4,
            },
            format="json",
        )
        assert crop_resp.status_code == 200
        payload = crop_resp.json()
        assert payload["avatarCrop"] == {
            "x": 0.1,
            "y": 0.2,
            "width": 0.3,
            "height": 0.4,
        }

        room = Room.objects.get(pk=int(self.room_id))
        assert room.avatar_crop_x == 0.1
        assert room.avatar_crop_y == 0.2
        assert room.avatar_crop_width == 0.3
        assert room.avatar_crop_height == 0.4

    def test_remove_group_avatar_via_avatar_action(self):
        avatar = SimpleUploadedFile("avatar.png", b"fake-image-content", content_type="image/png")
        set_resp = self.api_client.patch(
            f"/api/groups/{self.room_id}/",
            {"avatar": avatar},
            format="multipart",
        )
        assert set_resp.status_code == 200

        remove_resp = self.api_client.patch(
            f"/api/groups/{self.room_id}/",
            {"avatarAction": "remove"},
            format="json",
        )
        assert remove_resp.status_code == 200
        assert remove_resp.json()["avatarUrl"] is not None
        _assert_signed_media_url(remove_resp.json()["avatarUrl"])
        assert remove_resp.json()["avatarCrop"] is None

        room = Room.objects.get(pk=int(self.room_id))
        assert room.avatar_crop_x is None
        assert room.avatar_crop_y is None
        assert room.avatar_crop_width is None
        assert room.avatar_crop_height is None


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
        avatar = SimpleUploadedFile("avatar.png", b"fake-image-content", content_type="image/png")
        room = Room.objects.get(public_handle__handle="grp0")
        room.avatar.save(avatar.name, avatar, save=False)
        room.save(update_fields=["avatar"])

        self.api_client.force_authenticate(user=None)
        resp = self.api_client.get("/api/groups/public/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 3
        assert len(data["items"]) == 3
        for item in data["items"]:
            assert "avatarUrl" in item
            assert "avatarCrop" in item
            assert item["avatarUrl"] is not None
            _assert_signed_media_url(item["avatarUrl"])
        with_avatar = next((item for item in data["items"] if item["username"] == "grp0"), None)
        assert with_avatar is not None
        assert with_avatar["avatarUrl"] is not None
        _assert_signed_media_url(with_avatar["avatarUrl"])

    def test_search_public_groups(self):
        self.api_client.force_authenticate(user=None)
        resp = self.api_client.get("/api/groups/public/?search=grp1")
        assert resp.status_code == 200
        assert resp.json()["total"] == 1

    def test_public_groups_cursor_pagination_by_id(self):
        self.api_client.force_authenticate(user=None)

        first = self.api_client.get("/api/groups/public/?limit=1")
        assert first.status_code == 200
        first_payload = first.json()
        assert first_payload["pagination"]["limit"] == 1
        assert first_payload["pagination"]["hasMore"] is True
        assert first_payload["pagination"]["nextBefore"] is not None
        first_room_id = int(first_payload["items"][0]["roomId"])

        second = self.api_client.get(
            f"/api/groups/public/?limit=1&before={first_payload['pagination']['nextBefore']}"
        )
        assert second.status_code == 200
        second_payload = second.json()
        assert len(second_payload["items"]) == 1
        assert int(second_payload["items"][0]["roomId"]) < first_room_id


@pytest.mark.django_db
class TestMyGroupList(APITestCase):
    def setUp(self):
        self.api_client = TypedAPIClient()
        self.user = User.objects.create_user(username="member", password="testpass123")
        self.other = User.objects.create_user(username="other", password="testpass123")
        self.api_client.force_authenticate(user=self.user)

        self.api_client.post("/api/groups/", {"name": "Private Mine"}, format="json")
        self.api_client.post(
            "/api/groups/",
            {"name": "Public Mine", "isPublic": True, "username": "minepub"},
            format="json",
        )

        other_client = TypedAPIClient()
        other_client.force_authenticate(user=self.other)
        other_client.post(
            "/api/groups/",
            {"name": "Other Public", "isPublic": True, "username": "otherpub"},
            format="json",
        )

    def test_list_my_groups(self):
        resp = self.api_client.get("/api/groups/my/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 2
        names = sorted([item["name"] for item in data["items"]])
        assert names == ["Private Mine", "Public Mine"]
        assert all("avatarUrl" in item for item in data["items"])
        assert all("avatarCrop" in item for item in data["items"])
        assert all(item["avatarUrl"] is not None for item in data["items"])
        for item in data["items"]:
            _assert_signed_media_url(item["avatarUrl"])

    def test_search_my_groups(self):
        resp = self.api_client.get("/api/groups/my/?search=minepub")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 1
        assert data["items"][0]["name"] == "Public Mine"

    def test_my_groups_requires_auth(self):
        self.api_client.force_authenticate(user=None)
        resp = self.api_client.get("/api/groups/my/")
        assert resp.status_code == 403

    def test_my_groups_cursor_pagination_by_id(self):
        resp = self.api_client.get("/api/groups/my/?limit=1")
        assert resp.status_code == 200
        first_payload = resp.json()
        assert first_payload["pagination"]["limit"] == 1
        assert first_payload["pagination"]["hasMore"] is True
        assert first_payload["pagination"]["nextBefore"] is not None
        first_room_id = int(first_payload["items"][0]["roomId"])

        second = self.api_client.get(
            f"/api/groups/my/?limit=1&before={first_payload['pagination']['nextBefore']}"
        )
        assert second.status_code == 200
        second_payload = second.json()
        assert len(second_payload["items"]) == 1
        assert int(second_payload["items"][0]["roomId"]) < first_room_id


@pytest.mark.django_db
class TestPrivateGroupAccess(APITestCase):
    def setUp(self):
        self.api_client = TypedAPIClient()
        self.owner = User.objects.create_user(username="owner", password="testpass123")
        self.other = User.objects.create_user(username="other", password="testpass123")
        self.api_client.force_authenticate(user=self.owner)

        resp = self.api_client.post("/api/groups/", {"name": "Secret Group"}, format="json")
        self.room_id = resp.json()["roomId"]

    def test_private_group_hidden_from_non_member(self):
        self.api_client.force_authenticate(user=self.other)
        resp = self.api_client.get(f"/api/groups/{self.room_id}/")
        assert resp.status_code == 404

    def test_private_group_hidden_from_unauthenticated(self):
        self.api_client.force_authenticate(user=None)
        resp = self.api_client.get(f"/api/groups/{self.room_id}/")
        assert resp.status_code == 404
