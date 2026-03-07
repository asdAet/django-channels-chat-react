from django.conf import settings
from django.db import models
from typing import Optional


class Room(models.Model):
    class Kind(models.TextChoices):
        PUBLIC = "public", "Public"
        PRIVATE = "private", "Private"
        DIRECT = "direct", "Direct"
        GROUP = "group", "Group"

    name = models.CharField(max_length=50, db_index=True)
    slug = models.CharField(max_length=60, unique=True)
    kind = models.CharField(
        max_length=10,
        choices=Kind.choices,
        default=Kind.PRIVATE,
        db_index=True,
    )
    direct_pair_key = models.CharField(
        max_length=64,
        null=True,
        blank=True,
        unique=True,
        db_index=True,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="created_rooms",
    )
    created_by_id: Optional[int]

    # ── Group-specific fields ──────────────────────────────────────────
    description = models.TextField(blank=True, default="", max_length=2000)
    avatar = models.ImageField(upload_to="group_avatars/", null=True, blank=True)
    is_public = models.BooleanField(
        default=False,
        help_text="Public groups are discoverable and joinable without invite.",
    )
    username = models.CharField(
        max_length=50,
        unique=True,
        null=True,
        blank=True,
        help_text="Public group @username for search/join.",
    )
    slow_mode_seconds = models.PositiveIntegerField(
        default=0,
        help_text="Minimum delay between messages per member (0=off).",
    )
    join_approval_required = models.BooleanField(
        default=False,
        help_text="Require admin approval for join requests.",
    )
    max_members = models.PositiveIntegerField(default=200000)
    member_count = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "chat_room"

    def __str__(self):
        return str(self.name)

    @property
    def is_group(self) -> bool:
        return self.kind == self.Kind.GROUP
