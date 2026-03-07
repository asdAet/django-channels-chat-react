"""Group-specific models: invite links, join requests, pinned messages."""

from django.conf import settings
from django.db import models
from django.utils import timezone
from typing import Optional

from messages.models import Message
from rooms.models import Room


class InviteLink(models.Model):
    """A shareable link to join a group."""

    room = models.ForeignKey(
        Room,
        on_delete=models.CASCADE,
        related_name="invite_links",
    )
    code = models.CharField(max_length=32, unique=True, db_index=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="created_invite_links",
    )
    name = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text="Admin label for this invite link.",
    )
    expires_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Null means the link never expires.",
    )
    max_uses = models.PositiveIntegerField(
        default=0,
        help_text="0 means unlimited uses.",
    )
    use_count = models.PositiveIntegerField(default=0)
    is_revoked = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    room_id: int
    created_by_id: Optional[int]

    class Meta:
        db_table = "groups_invite_link"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["room", "is_revoked"], name="invite_room_revoked_idx"),
        ]

    def __str__(self):
        return f"{self.room.slug}:{self.code}"

    @property
    def is_expired(self) -> bool:
        if self.is_revoked:
            return True
        if self.expires_at and timezone.now() > self.expires_at:
            return True
        if self.max_uses > 0 and self.use_count >= self.max_uses:
            return True
        return False


class JoinRequest(models.Model):
    """A pending request to join a group that requires admin approval."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    room = models.ForeignKey(
        Room,
        on_delete=models.CASCADE,
        related_name="join_requests",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="group_join_requests",
    )
    invite_link = models.ForeignKey(
        InviteLink,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="join_requests",
    )
    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="reviewed_join_requests",
    )
    message = models.TextField(
        blank=True,
        default="",
        max_length=500,
        help_text="Optional message from the user requesting to join.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    room_id: int
    user_id: int
    invite_link_id: Optional[int]
    reviewed_by_id: Optional[int]

    class Meta:
        db_table = "groups_join_request"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["room", "user"],
                condition=models.Q(status="pending"),
                name="one_pending_request_per_user",
            ),
        ]
        indexes = [
            models.Index(fields=["room", "status"], name="joinreq_room_status_idx"),
        ]

    def __str__(self):
        return f"{self.room.slug}:{self.user.username}:{self.status}"


class PinnedMessage(models.Model):
    """A message pinned in a group."""

    room = models.ForeignKey(
        Room,
        on_delete=models.CASCADE,
        related_name="pinned_messages",
    )
    message = models.ForeignKey(
        Message,
        on_delete=models.CASCADE,
        related_name="pins",
    )
    pinned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    pinned_at = models.DateTimeField(auto_now_add=True)
    room_id: int
    message_id: int
    pinned_by_id: Optional[int]

    class Meta:
        db_table = "groups_pinned_message"
        ordering = ["-pinned_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["room", "message"],
                name="pin_room_message_uniq",
            ),
        ]

    def __str__(self):
        return f"{self.room.slug}:pin:{self.message_id}"
