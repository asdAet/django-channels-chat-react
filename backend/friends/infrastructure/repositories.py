"""ORM repositories for friendship queries."""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db.models import Q, QuerySet

from friends.models import Friendship

User = get_user_model()


def get_user_by_username(username: str):
    return User.objects.filter(username=username).first()


def get_user_by_id(user_id: int):
    return User.objects.filter(id=user_id).first()


def get_friendship(from_user, to_user) -> Friendship | None:
    return Friendship.objects.filter(from_user=from_user, to_user=to_user).first()


def get_friendship_by_id(friendship_id: int) -> Friendship | None:
    return (
        Friendship.objects.filter(id=friendship_id)
        .select_related("from_user", "to_user")
        .first()
    )


def list_friends_for_user(user) -> QuerySet:
    """Return accepted friendships where user is from_user (the paired row)."""
    return (
        Friendship.objects.filter(from_user=user, status=Friendship.Status.ACCEPTED)
        .select_related("to_user", "to_user__profile")
        .order_by("-updated_at")
    )


def list_pending_incoming(user) -> QuerySet:
    return (
        Friendship.objects.filter(to_user=user, status=Friendship.Status.PENDING)
        .select_related("from_user", "from_user__profile")
        .order_by("-created_at")
    )


def list_pending_outgoing(user) -> QuerySet:
    return (
        Friendship.objects.filter(from_user=user, status=Friendship.Status.PENDING)
        .select_related("to_user", "to_user__profile")
        .order_by("-created_at")
    )


def list_blocked_by_user(user) -> QuerySet:
    return (
        Friendship.objects.filter(from_user=user, status=Friendship.Status.BLOCKED)
        .select_related("to_user", "to_user__profile")
        .order_by("-updated_at")
    )


def delete_friendship_pair(user_a, user_b, *, status: str | None = None) -> int:
    """Delete both directions of a friendship with optional status filter."""
    queryset = Friendship.objects.filter(
        Q(from_user=user_a, to_user=user_b) | Q(from_user=user_b, to_user=user_a)
    )
    if status is not None:
        queryset = queryset.filter(status=status)
    deleted, _ = queryset.delete()
    return deleted
