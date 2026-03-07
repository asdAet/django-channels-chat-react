"""Discord-style bitwise permission system.

Each permission is a single bit in a 64-bit integer.
Roles store a bitmask of granted permissions.
Resolution: base(@everyone) | role1 | role2 | ... → effective permissions.
ADMINISTRATOR bypasses all checks.
"""

from enum import IntFlag


class Perm(IntFlag):
    """Granular permission flags (Discord-inspired)."""

    # --- Chat -----------------------------------------------------------
    SEND_MESSAGES = 1 << 0
    READ_MESSAGES = 1 << 1
    ATTACH_FILES = 1 << 2
    EMBED_LINKS = 1 << 3
    MENTION_EVERYONE = 1 << 4
    ADD_REACTIONS = 1 << 5

    # --- Moderation -----------------------------------------------------
    MANAGE_MESSAGES = 1 << 8      # delete / pin others' messages
    KICK_MEMBERS = 1 << 9
    BAN_MEMBERS = 1 << 10
    MUTE_MEMBERS = 1 << 11
    PIN_MESSAGES = 1 << 12
    INVITE_USERS = 1 << 13        # create / share invite links
    CHANGE_GROUP_INFO = 1 << 14   # edit group name / description / avatar

    # --- Administration -------------------------------------------------
    MANAGE_ROLES = 1 << 16        # create / edit / delete / assign roles
    MANAGE_ROOM = 1 << 17         # edit room name / settings / delete
    MANAGE_INVITES = 1 << 18
    VIEW_AUDIT_LOG = 1 << 19

    # --- Voice (future) -------------------------------------------------
    VOICE_CONNECT = 1 << 24
    VOICE_SPEAK = 1 << 25
    VOICE_MUTE_OTHERS = 1 << 26
    VOICE_DEAFEN_OTHERS = 1 << 27

    # --- Super ----------------------------------------------------------
    ADMINISTRATOR = 1 << 32       # bypasses every check


# ── Preset bundles ──────────────────────────────────────────────────────

PRESET_OWNER = Perm.ADMINISTRATOR

PRESET_ADMIN = (
    Perm.SEND_MESSAGES
    | Perm.READ_MESSAGES
    | Perm.ATTACH_FILES
    | Perm.EMBED_LINKS
    | Perm.MENTION_EVERYONE
    | Perm.ADD_REACTIONS
    | Perm.MANAGE_MESSAGES
    | Perm.KICK_MEMBERS
    | Perm.BAN_MEMBERS
    | Perm.MUTE_MEMBERS
    | Perm.PIN_MESSAGES
    | Perm.INVITE_USERS
    | Perm.CHANGE_GROUP_INFO
    | Perm.MANAGE_INVITES
    | Perm.VIEW_AUDIT_LOG
)

PRESET_MODERATOR = (
    Perm.SEND_MESSAGES
    | Perm.READ_MESSAGES
    | Perm.ATTACH_FILES
    | Perm.EMBED_LINKS
    | Perm.ADD_REACTIONS
    | Perm.MANAGE_MESSAGES
    | Perm.KICK_MEMBERS
    | Perm.MUTE_MEMBERS
    | Perm.PIN_MESSAGES
)

PRESET_MEMBER = (
    Perm.SEND_MESSAGES
    | Perm.READ_MESSAGES
    | Perm.ATTACH_FILES
    | Perm.EMBED_LINKS
    | Perm.ADD_REACTIONS
    | Perm.INVITE_USERS
)

PRESET_VIEWER = Perm.READ_MESSAGES

# Default @everyone permissions per room kind
EVERYONE_PUBLIC = Perm.SEND_MESSAGES | Perm.READ_MESSAGES | Perm.ADD_REACTIONS
EVERYONE_PRIVATE = Perm(0)  # invite-only, no default access

# Group @everyone defaults
EVERYONE_GROUP_PUBLIC = Perm.SEND_MESSAGES | Perm.READ_MESSAGES | Perm.ADD_REACTIONS | Perm.INVITE_USERS
EVERYONE_GROUP_PRIVATE = Perm.READ_MESSAGES | Perm.SEND_MESSAGES | Perm.ADD_REACTIONS

# Full access for DM participants (no roles, just pair_key check)
DM_PARTICIPANT = Perm.SEND_MESSAGES | Perm.READ_MESSAGES | Perm.ATTACH_FILES | Perm.EMBED_LINKS


# ── Helpers ─────────────────────────────────────────────────────────────

ALL_PERMISSIONS = Perm(-1)  # every bit set


def has_perm(permissions: int, perm: Perm) -> bool:
    """Check if a permission bitmask includes the given permission."""
    if int(permissions) & Perm.ADMINISTRATOR:
        return True
    return bool(int(permissions) & perm)
