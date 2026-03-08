from rest_framework import serializers

from .models import Message, MessageAttachment


class AttachmentSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    thumbnailUrl = serializers.SerializerMethodField()
    originalFilename = serializers.CharField(source="original_filename")
    contentType = serializers.CharField(source="content_type")
    fileSize = serializers.IntegerField(source="file_size")

    class Meta:
        model = MessageAttachment
        fields = (
            "id", "originalFilename", "contentType", "fileSize",
            "url", "thumbnailUrl", "width", "height",
        )
        read_only_fields = fields

    def _build_url(self, field_file):
        build_fn = self.context.get("build_profile_pic_url")
        if not build_fn or not field_file:
            return None
        return build_fn(field_file)

    def get_url(self, obj):
        return self._build_url(obj.file)

    def get_thumbnailUrl(self, obj):
        return self._build_url(obj.thumbnail)


class MessageSerializer(serializers.ModelSerializer):
    content = serializers.CharField(source="message_content")
    createdAt = serializers.DateTimeField(source="date_added")
    profilePic = serializers.SerializerMethodField()
    avatarCrop = serializers.SerializerMethodField()

    editedAt = serializers.DateTimeField(source="edited_at", allow_null=True, default=None)
    isDeleted = serializers.BooleanField(source="is_deleted", read_only=True)

    replyTo = serializers.SerializerMethodField()
    attachments = AttachmentSerializer(many=True, read_only=True)
    reactions = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = (
            "id", "username", "content", "profilePic", "avatarCrop",
            "createdAt", "editedAt", "isDeleted",
            "replyTo", "attachments", "reactions",
        )
        read_only_fields = fields

    def get_profilePic(self, obj):
        if obj.is_deleted:
            return None
        build_fn = self.context.get("build_profile_pic_url")
        if not build_fn:
            return None

        user = getattr(obj, "user", None)
        if user:
            profile = getattr(user, "profile", None)
            image = getattr(profile, "image", None) if profile else None
            if image:
                return build_fn(image)

        return build_fn(obj.profile_pic) if obj.profile_pic else None

    def get_avatarCrop(self, obj):
        if obj.is_deleted:
            return None
        serialize_fn = self.context.get("serialize_avatar_crop")
        if not serialize_fn:
            return None

        user = getattr(obj, "user", None)
        if user:
            profile = getattr(user, "profile", None)
            if profile:
                return serialize_fn(profile)
        return None

    def get_replyTo(self, obj):
        reply = obj.reply_to
        if not reply:
            return None
        if reply.is_deleted:
            return {"id": reply.id, "username": None, "content": "[deleted]"}
        return {
            "id": reply.id,
            "username": reply.user.username if reply.user else reply.username,
            "content": reply.message_content[:150],
        }

    def get_reactions(self, obj):
        reactions_qs = obj.reactions.all()
        counts: dict[str, int] = {}
        user_reacted: set[str] = set()
        request = self.context.get("request")
        current_user_id = getattr(getattr(request, "user", None), "pk", None)

        for r in reactions_qs:
            counts[r.emoji] = counts.get(r.emoji, 0) + 1
            if current_user_id and r.user_id == current_user_id:
                user_reacted.add(r.emoji)

        return [
            {"emoji": emoji, "count": count, "me": emoji in user_reacted}
            for emoji, count in counts.items()
        ]

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        user = getattr(instance, "user", None)
        if user:
            ret["username"] = user.username
        if instance.is_deleted:
            ret["content"] = "[deleted]"
        return ret


class MessageCreateSerializer(serializers.Serializer):
    message = serializers.CharField(max_length=1000)


class MessagePaginationSerializer(serializers.Serializer):
    messages = MessageSerializer(many=True)
    pagination = serializers.DictField()
