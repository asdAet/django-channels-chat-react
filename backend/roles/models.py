"""Discord-style role and membership models.

Role      — per-room role definition with permissions bitmask and hierarchy.
Membership — links a user to a room; carries M2M roles and ban state.

Direct chats have no roles — access is based on Room.direct_pair_key.
"""

from django.conf import settings
from django.db import models
from typing import Optional

from rooms.models import Room

from .permissions import (
    EVERYONE_GROUP_PRIVATE,
    EVERYONE_GROUP_PUBLIC,
    EVERYONE_PRIVATE,
    EVERYONE_PUBLIC,
    PRESET_ADMIN,
    PRESET_MEMBER,
    PRESET_MODERATOR,
    PRESET_OWNER,
    PRESET_VIEWER,
)


class Role(models.Model):
    """A named role with a permission bitmask, scoped to a room."""

    room = models.ForeignKey(
        Room,
        on_delete=models.CASCADE,
        related_name="roles",
    )
    name = models.CharField(max_length=100)
    color = models.CharField(
        max_length=7,
        default="#99AAB5",
        help_text="Hex color code, e.g. #FF0000",
    )
    position = models.PositiveIntegerField(
        default=0,
        help_text="Higher position = more authority. Used to resolve hierarchy.",
    )
    permissions = models.BigIntegerField(
        default=0,
        help_text="Bitwise permission mask (see roles.permissions.Perm).",
    )
    is_default = models.BooleanField(
        default=False,
        help_text="If True, this is the @everyone role (auto-applied to all members).",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "roles_role"
        ordering = ["-position"]
        constraints = [
            models.UniqueConstraint(
                fields=["room", "name"],
                name="role_room_name_uniq",
            ),
        ]
        indexes = [
            models.Index(fields=["room", "position"], name="role_room_position_idx"),
        ]

    def __str__(self):
        return f"{self.room.slug}:{self.name}"

    # ── Convenience helpers for creating standard roles ──────────────

    @classmethod
    def create_defaults_for_room(cls, room: Room) -> dict[str, "Role"]:
        """Create the standard role set for a non-DM room.

        Returns a dict keyed by canonical name:
            {"@everyone": ..., "Viewer": ..., "Member": ...,
             "Moderator": ..., "Admin": ..., "Owner": ...}
        """
        if room.kind == Room.Kind.GROUP:
            if room.is_public:
                everyone_perms = int(EVERYONE_GROUP_PUBLIC)
            else:
                everyone_perms = int(EVERYONE_GROUP_PRIVATE)
        elif room.kind == Room.Kind.PUBLIC:
            everyone_perms = int(EVERYONE_PUBLIC)
        else:
            everyone_perms = int(EVERYONE_PRIVATE)

        defaults = [
            ("@everyone", 0, everyone_perms, True),
            ("Viewer", 10, int(PRESET_VIEWER), False),
            ("Member", 20, int(PRESET_MEMBER), False),
            ("Moderator", 40, int(PRESET_MODERATOR), False),
            ("Admin", 60, int(PRESET_ADMIN), False),
            ("Owner", 80, int(PRESET_OWNER), False),
        ]

        created = {}
        for name, position, perms, is_def in defaults:
            role, _ = cls.objects.get_or_create(
                room=room,
                name=name,
                defaults={
                    "position": position,
                    "permissions": perms,
                    "is_default": is_def,
                },
            )
            created[name] = role
        return created


class Membership(models.Model):
    """Links a user to a room with optional roles and ban state.

    For direct chats, membership is created with no roles —
    access is purely based on Room.direct_pair_key.
    """

    room = models.ForeignKey(
        Room,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="room_memberships",
    )
    roles = models.ManyToManyField(
        Role,
        related_name="members",
        blank=True,
    )
    nickname = models.CharField(
        max_length=32,
        blank=True,
        default="",
        help_text="Per-room display name (like Discord server nickname).",
    )
    is_banned = models.BooleanField(default=False)
    ban_reason = models.TextField(blank=True, default="")
    banned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="bans_issued",
    )
    muted_until = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Muted until this time (null = not muted).",
    )
    muted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="mutes_issued",
    )
    joined_at = models.DateTimeField(auto_now_add=True)
    room_id: int
    user_id: int
    banned_by_id: Optional[int]
    muted_by_id: Optional[int]

    class Meta:
        db_table = "roles_membership"
        constraints = [
            models.UniqueConstraint(
                fields=["room", "user"],
                name="membership_room_user_uniq",
            ),
        ]
        indexes = [
            models.Index(fields=["user", "room"], name="membership_user_room_idx"),
        ]

    def __str__(self):
        return f"{self.room.slug}:{self.user.username}"

    @property
    def display_name(self) -> str:
        """Returns nickname if set, otherwise username."""
        return self.nickname or self.user.username

    @property
    def is_muted(self) -> bool:
        if self.muted_until is None:
            return False
        from django.utils import timezone
        return self.muted_until > timezone.now()


class PermissionOverride(models.Model):
    """Per-role or per-user permission override within a room.

    Works like Discord channel permission overrides:
    - `allow` bits are added on top of computed permissions.
    - `deny` bits are removed from computed permissions.
    - User-level overrides take precedence over role-level.
    """

    room = models.ForeignKey(
        Room,
        on_delete=models.CASCADE,
        related_name="permission_overrides",
    )
    target_role = models.ForeignKey(
        Role,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="overrides",
    )
    target_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="permission_overrides",
    )
    allow = models.BigIntegerField(default=0)
    deny = models.BigIntegerField(default=0)

    class Meta:
        db_table = "roles_permissionoverride"
        constraints = [
            models.CheckConstraint(
                check=(
                    models.Q(target_role__isnull=False)
                    | models.Q(target_user__isnull=False)
                ),
                name="override_has_target",
            ),
        ]

    def __str__(self):
        target = self.target_role or self.target_user
        return f"{self.room.slug}:override:{target}"
