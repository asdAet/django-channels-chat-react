from rest_framework import serializers


class UserSerializer(serializers.Serializer):
    name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)
    username = serializers.CharField()
    email = serializers.EmailField()
    profileImage = serializers.CharField(allow_null=True)
    avatarCrop = serializers.DictField(allow_null=True)
    bio = serializers.CharField(allow_blank=True)
    lastSeen = serializers.CharField(allow_null=True)
    registeredAt = serializers.CharField(allow_null=True)


class PeerSerializer(serializers.Serializer):
    username = serializers.CharField()
    profileImage = serializers.CharField(allow_null=True)
    avatarCrop = serializers.DictField(allow_null=True)
    lastSeen = serializers.CharField(allow_null=True)


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField()


class RegisterSerializer(serializers.Serializer):
    name = serializers.CharField()
    last_name = serializers.CharField(required=False, allow_blank=True)
    username = serializers.CharField()
    password1 = serializers.CharField()
    password2 = serializers.CharField()


class LogoutSerializer(serializers.Serializer):
    """Empty serializer used to render a POST form for logout in Browsable API."""


class ProfileUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)
    username = serializers.CharField(required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    bio = serializers.CharField(required=False, allow_blank=True)
    image = serializers.ImageField(required=False, allow_null=True)
    avatarCropX = serializers.FloatField(required=False)
    avatarCropY = serializers.FloatField(required=False)
    avatarCropWidth = serializers.FloatField(required=False)
    avatarCropHeight = serializers.FloatField(required=False)
