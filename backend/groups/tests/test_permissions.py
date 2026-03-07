"""Tests for group permission resolution including mute."""

import pytest
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from roles.application.permission_service import compute_permissions
from roles.models import Membership, Role
from roles.permissions import Perm
from rooms.models import Room

User = get_user_model()


@pytest.mark.django_db
class TestGroupPermissions(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="owner", password="testpass123")
        self.member_user = User.objects.create_user(username="member", password="testpass123")
        self.outsider = User.objects.create_user(username="outsider", password="testpass123")

        self.room = Room.objects.create(
            name="Test Group",
            slug="g-test-permissions-abc12345",
            kind=Room.Kind.GROUP,
            is_public=False,
            created_by=self.owner,
        )
        roles = Role.create_defaults_for_room(self.room)

        owner_ms = Membership.objects.create(room=self.room, user=self.owner)
        owner_ms.roles.add(roles["Owner"])

        member_ms = Membership.objects.create(room=self.room, user=self.member_user)
        member_ms.roles.add(roles["Member"])

    def test_owner_has_administrator(self):
        perms = compute_permissions(self.room, self.owner)
        assert perms & Perm.ADMINISTRATOR

    def test_member_can_read_write(self):
        perms = compute_permissions(self.room, self.member_user)
        assert perms & Perm.READ_MESSAGES
        assert perms & Perm.SEND_MESSAGES
        assert perms & Perm.INVITE_USERS

    def test_outsider_has_no_access_to_private_group(self):
        perms = compute_permissions(self.room, self.outsider)
        assert not (perms & Perm.READ_MESSAGES)
        assert not (perms & Perm.SEND_MESSAGES)

    def test_unauthenticated_has_no_access_to_private_group(self):
        perms = compute_permissions(self.room, None)
        assert perms == Perm(0)

    def test_muted_member_cannot_send(self):
        ms = Membership.objects.get(room=self.room, user=self.member_user)
        ms.muted_until = timezone.now() + timedelta(hours=1)
        ms.save(update_fields=["muted_until"])

        perms = compute_permissions(self.room, self.member_user)
        assert perms & Perm.READ_MESSAGES
        assert not (perms & Perm.SEND_MESSAGES)

    def test_expired_mute_allows_send(self):
        ms = Membership.objects.get(room=self.room, user=self.member_user)
        ms.muted_until = timezone.now() - timedelta(hours=1)
        ms.save(update_fields=["muted_until"])

        perms = compute_permissions(self.room, self.member_user)
        assert perms & Perm.SEND_MESSAGES

    def test_banned_member_has_no_permissions(self):
        ms = Membership.objects.get(room=self.room, user=self.member_user)
        ms.is_banned = True
        ms.save(update_fields=["is_banned"])

        perms = compute_permissions(self.room, self.member_user)
        assert perms == Perm(0)


@pytest.mark.django_db
class TestPublicGroupPermissions(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="owner", password="testpass123")
        self.outsider = User.objects.create_user(username="outsider", password="testpass123")

        self.room = Room.objects.create(
            name="Public Group",
            slug="g-public-perm-test-abc12345",
            kind=Room.Kind.GROUP,
            is_public=True,
            username="pubpermtest",
            created_by=self.owner,
        )
        roles = Role.create_defaults_for_room(self.room)
        owner_ms = Membership.objects.create(room=self.room, user=self.owner)
        owner_ms.roles.add(roles["Owner"])

    def test_unauthenticated_can_read_public_group(self):
        perms = compute_permissions(self.room, None)
        assert perms & Perm.READ_MESSAGES

    def test_outsider_gets_everyone_permissions(self):
        perms = compute_permissions(self.room, self.outsider)
        assert perms & Perm.READ_MESSAGES
        assert perms & Perm.SEND_MESSAGES
