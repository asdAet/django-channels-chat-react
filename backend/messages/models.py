from django.conf import settings
from django.db import models
from django.utils import timezone
from typing import Optional

from rooms.models import Room


class Message(models.Model):
    username = models.CharField(max_length=50, db_index=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="chat_messages",
    )
    room = models.ForeignKey(
        Room,
        on_delete=models.CASCADE,
        related_name="messages",
    )
    message_content = models.TextField()
    date_added = models.DateTimeField(default=timezone.now, db_index=True)
    profile_pic = models.CharField(max_length=255, blank=True, null=True)

    # ── Edit / Delete ──────────────────────────────────────────────────
    edited_at = models.DateTimeField(null=True, blank=True)
    is_deleted = models.BooleanField(default=False, db_index=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    deleted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="deleted_messages",
    )
    original_content = models.TextField(blank=True, default="")

    # ── Reply ──────────────────────────────────────────────────────────
    reply_to = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="replies",
    )
    user_id: Optional[int]
    room_id: int
    deleted_by_id: Optional[int]
    reply_to_id: Optional[int]

    class Meta:
        db_table = "chat_message"
        ordering = ("date_added",)
        indexes = [
            models.Index(fields=["room", "date_added"], name="msg_room_date_idx"),
            models.Index(fields=["username", "date_added"], name="msg_user_date_idx"),
        ]

    def __str__(self):
        name = self.user.username if self.user else self.username
        return f"{name}: {self.message_content}"


class Reaction(models.Model):
    message = models.ForeignKey(
        Message,
        on_delete=models.CASCADE,
        related_name="reactions",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="reactions",
    )
    emoji = models.CharField(max_length=32)
    created_at = models.DateTimeField(auto_now_add=True)
    message_id: int
    user_id: int

    class Meta:
        db_table = "messages_reaction"
        constraints = [
            models.UniqueConstraint(
                fields=["message", "user", "emoji"],
                name="reaction_msg_user_emoji_uniq",
            ),
        ]
        indexes = [
            models.Index(fields=["message"], name="reaction_message_idx"),
        ]

    def __str__(self):
        return f"{self.user_id}:{self.emoji}:msg{self.message_id}"


class MessageAttachment(models.Model):
    message = models.ForeignKey(
        Message,
        on_delete=models.CASCADE,
        related_name="attachments",
    )
    file = models.FileField(upload_to="chat_attachments/%Y/%m/")
    original_filename = models.CharField(max_length=255)
    content_type = models.CharField(max_length=100)
    file_size = models.PositiveIntegerField()
    thumbnail = models.ImageField(
        upload_to="chat_thumbnails/%Y/%m/",
        null=True,
        blank=True,
    )
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    message_id: int

    class Meta:
        db_table = "messages_attachment"
        ordering = ["uploaded_at"]
        indexes = [
            models.Index(fields=["message"], name="attachment_message_idx"),
        ]

    def __str__(self):
        return f"{self.message_id}:{self.original_filename}"


class MessageReadState(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="read_states",
    )
    room = models.ForeignKey(
        Room,
        on_delete=models.CASCADE,
        related_name="read_states",
    )
    last_read_message = models.ForeignKey(
        Message,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    last_read_at = models.DateTimeField(auto_now=True)
    user_id: int
    room_id: int
    last_read_message_id: Optional[int]

    class Meta:
        db_table = "messages_read_state"
        constraints = [
            models.UniqueConstraint(
                fields=["user", "room"],
                name="read_state_user_room_uniq",
            ),
        ]

    def __str__(self):
        return f"{self.user_id}:room{self.room_id}:msg{self.last_read_message_id}"
