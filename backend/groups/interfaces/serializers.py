"""DRF serializers for the groups API."""

from rest_framework import serializers


# ── Group ──────────────────────────────────────────────────────────────

class GroupCreateInputSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=50)
    description = serializers.CharField(max_length=2000, required=False, default="")
    isPublic = serializers.BooleanField(required=False)
    username = serializers.CharField(max_length=50, required=False, allow_null=True, default=None)


class GroupUpdateInputSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=50, required=False)
    description = serializers.CharField(max_length=2000, required=False)
    isPublic = serializers.BooleanField(required=False)
    username = serializers.CharField(max_length=50, required=False, allow_null=True)
    slowModeSeconds = serializers.IntegerField(required=False, min_value=0, max_value=86400)
    joinApprovalRequired = serializers.BooleanField(required=False)


class GroupOutputSerializer(serializers.Serializer):
    slug = serializers.CharField()
    name = serializers.CharField()
    description = serializers.CharField()
    isPublic = serializers.BooleanField()
    username = serializers.CharField(allow_null=True)
    memberCount = serializers.IntegerField()
    slowModeSeconds = serializers.IntegerField()
    joinApprovalRequired = serializers.BooleanField()
    createdBy = serializers.CharField(allow_null=True)
    avatarUrl = serializers.CharField(allow_null=True)


class GroupListItemSerializer(serializers.Serializer):
    slug = serializers.CharField()
    name = serializers.CharField()
    description = serializers.CharField()
    username = serializers.CharField(allow_null=True)
    memberCount = serializers.IntegerField()


# ── Invite ─────────────────────────────────────────────────────────────

class InviteCreateInputSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100, required=False, default="")
    expiresInSeconds = serializers.IntegerField(required=False, allow_null=True, default=None, min_value=60)
    maxUses = serializers.IntegerField(required=False, default=0, min_value=0)


class InviteOutputSerializer(serializers.Serializer):
    code = serializers.CharField()
    name = serializers.CharField()
    createdBy = serializers.SerializerMethodField()
    expiresAt = serializers.DateTimeField(source="expires_at", allow_null=True)
    maxUses = serializers.IntegerField(source="max_uses")
    useCount = serializers.IntegerField(source="use_count")
    isRevoked = serializers.BooleanField(source="is_revoked")
    isExpired = serializers.BooleanField(source="is_expired")
    createdAt = serializers.DateTimeField(source="created_at")

    def get_createdBy(self, obj):
        return obj.created_by.username if obj.created_by else None


class InvitePreviewSerializer(serializers.Serializer):
    code = serializers.CharField()
    groupSlug = serializers.CharField()
    groupName = serializers.CharField()
    groupDescription = serializers.CharField()
    memberCount = serializers.IntegerField()
    isPublic = serializers.BooleanField()


# ── Members ────────────────────────────────────────────────────────────

class MemberOutputSerializer(serializers.Serializer):
    userId = serializers.IntegerField()
    username = serializers.CharField()
    nickname = serializers.CharField(allow_null=True)
    roles = serializers.ListField()
    joinedAt = serializers.CharField()
    isMuted = serializers.BooleanField()


class BannedMemberSerializer(serializers.Serializer):
    userId = serializers.IntegerField()
    username = serializers.CharField()
    reason = serializers.CharField()
    bannedBy = serializers.CharField(allow_null=True)


class BanInputSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=500, required=False, default="")


class MuteInputSerializer(serializers.Serializer):
    durationSeconds = serializers.IntegerField(min_value=1, max_value=366 * 86400)


# ── Join Requests ──────────────────────────────────────────────────────

class JoinRequestOutputSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    userId = serializers.IntegerField()
    username = serializers.CharField()
    message = serializers.CharField()
    createdAt = serializers.CharField()


# ── Pins ───────────────────────────────────────────────────────────────

class PinInputSerializer(serializers.Serializer):
    messageId = serializers.IntegerField()


class PinOutputSerializer(serializers.Serializer):
    messageId = serializers.IntegerField()
    content = serializers.CharField()
    author = serializers.CharField()
    pinnedBy = serializers.CharField(allow_null=True)
    pinnedAt = serializers.CharField()
    createdAt = serializers.CharField()


# ── Ownership ──────────────────────────────────────────────────────────

class TransferOwnershipInputSerializer(serializers.Serializer):
    userId = serializers.IntegerField()
