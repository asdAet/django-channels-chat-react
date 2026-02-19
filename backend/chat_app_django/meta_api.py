"""Read-only meta endpoints for frontend runtime configuration."""

from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods


@require_http_methods(["GET"])
def client_config_view(_request):
    """Returns client-facing limits and policies from backend settings."""
    return JsonResponse(
        {
            "usernameMaxLength": int(getattr(settings, "USERNAME_MAX_LENGTH", 30)),
            "chatMessageMaxLength": int(getattr(settings, "CHAT_MESSAGE_MAX_LENGTH", 1000)),
            "chatRoomSlugRegex": str(
                getattr(settings, "CHAT_ROOM_SLUG_REGEX", r"^[A-Za-z0-9_-]{3,50}$")
            ),
            "mediaUrlTtlSeconds": int(getattr(settings, "MEDIA_URL_TTL_SECONDS", 300)),
            "mediaMode": "signed_only",
        }
    )
