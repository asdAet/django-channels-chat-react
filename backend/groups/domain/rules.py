"""Group-specific business rules and validations."""

from __future__ import annotations

import re
import secrets
import string

from django.conf import settings

from rooms.models import Room

# Characters used for invite codes (URL-safe)
_INVITE_ALPHABET = string.ascii_letters + string.digits


def generate_invite_code() -> str:
    """Generate a cryptographically random invite code."""
    length = getattr(settings, "GROUP_INVITE_CODE_LENGTH", 12)
    return "".join(secrets.choice(_INVITE_ALPHABET) for _ in range(length))


def validate_group_name(name: str) -> str:
    """Validate and clean group name."""
    name = name.strip()
    if not name:
        raise ValueError("Group name cannot be empty")
    if len(name) > 50:
        raise ValueError("Group name cannot exceed 50 characters")
    return name


def validate_group_username(username: str | None) -> str | None:
    """Validate public group @username (alphanumeric + underscores, 3-50 chars)."""
    if username is None or username == "":
        return None
    username = username.strip().lower()
    if not re.match(r"^[a-z][a-z0-9_]{2,49}$", username):
        raise ValueError(
            "Username must start with a letter, contain only lowercase "
            "letters, digits and underscores, and be 3-50 characters long"
        )
    return username


def validate_group_description(description: str) -> str:
    if len(description) > 2000:
        raise ValueError("Description cannot exceed 2000 characters")
    return description


def validate_slow_mode(seconds: int) -> int:
    if seconds < 0:
        raise ValueError("Slow mode seconds must be >= 0")
    if seconds > 86400:  # 24 hours max
        raise ValueError("Slow mode cannot exceed 24 hours")
    return seconds


def ensure_is_group(room: Room) -> None:
    """Raise if the room is not a group."""
    if room.kind != Room.Kind.GROUP:
        raise ValueError("This operation is only available for groups")


def generate_group_slug(name: str) -> str:
    """Generate a URL-safe slug from a group name."""
    slug = re.sub(r"[^a-zA-Z0-9]", "-", name.strip()).strip("-").lower()
    slug = re.sub(r"-+", "-", slug)
    if len(slug) < 3:
        slug = slug + "-" + secrets.token_hex(4)
    # Add random suffix to ensure uniqueness
    suffix = secrets.token_hex(4)
    slug = f"g-{slug[:36]}-{suffix}"
    return slug
