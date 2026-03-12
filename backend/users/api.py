"""API РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№: auth/session/profile/media endpoints."""

from __future__ import annotations

import time
from collections.abc import Mapping
from datetime import timedelta
from urllib.parse import quote

from django.conf import settings
from django.contrib.auth import authenticate, login, logout, password_validation
from django.contrib.auth.models import User
from django.core.files.storage import default_storage
from django.db import IntegrityError, OperationalError, ProgrammingError
from django.http import FileResponse, HttpResponse
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.utils import timezone
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework.decorators import api_view
from rest_framework.exceptions import ParseError, UnsupportedMediaType
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from chat_app_django.media_utils import (
    build_profile_url_from_request,
    is_valid_media_signature,
    normalize_media_path,
    serialize_avatar_crop,
)
from chat_app_django.http_utils import error_response, parse_request_payload
from chat_app_django.ip_utils import get_client_ip_from_request
from chat_app_django.security.audit import audit_http_event
from chat_app_django.security.rate_limit import DbRateLimiter, RateLimitPolicy

from .forms import ProfileUpdateForm, UserRegisterForm, UserUpdateForm
from .serializers import LoginSerializer, LogoutSerializer, ProfileUpdateSerializer, RegisterSerializer


def _serialize_user(request, user):
    """РЎРµСЂРёР°Р»РёР·СѓРµС‚ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ РІ РµРґРёРЅС‹Р№ С„РѕСЂРјР°С‚ auth/profile API."""
    profile = getattr(user, "profile", None)
    profile_image = None
    if profile and getattr(profile, "image", None):
        image_name = getattr(profile.image, "name", "")
        if image_name:
            profile_image = build_profile_url_from_request(request, image_name)
    last_seen = getattr(profile, "last_seen", None)

    return {
        "name": (user.first_name or "").strip(),
        "last_name": (user.last_name or "").strip(),
        "username": user.username,
        "email": user.email,
        "profileImage": profile_image,
        "avatarCrop": serialize_avatar_crop(profile),
        "bio": getattr(profile, "bio", "") or "",
        "lastSeen": last_seen.isoformat() if last_seen else None,
        "registeredAt": user.date_joined.isoformat() if getattr(user, "date_joined", None) else None,
    }


def _collect_errors(*errors):
    """РћР±СЉРµРґРёРЅСЏРµС‚ ValidationError-СЃР»РѕРІР°СЂРё РёР· РЅРµСЃРєРѕР»СЊРєРёС… С„РѕСЂРј."""
    combined = {}
    for error_dict in errors:
        for field, messages in error_dict.items():
            combined[field] = list(messages)
    return combined


def _get_client_ip(request) -> str:
    """Р’РѕР·РІСЂР°С‰Р°РµС‚ IP РєР»РёРµРЅС‚Р° СЃ СѓС‡РµС‚РѕРј trusted proxy."""
    return get_client_ip_from_request(request) or ""


def _rate_limited(request, action: str) -> bool:
    """РџСЂРѕРІРµСЂСЏРµС‚ auth rate-limit С‡РµСЂРµР· РїРµСЂСЃРёСЃС‚РµРЅС‚РЅС‹Р№ DB-limiter."""
    limit = int(getattr(settings, "AUTH_RATE_LIMIT", 10))
    window = int(getattr(settings, "AUTH_RATE_WINDOW", 60))
    ip = _get_client_ip(request) or "unknown"
    scope_key = f"rl:auth:{action}:{ip}"
    policy = RateLimitPolicy(limit=limit, window_seconds=window)
    return DbRateLimiter.is_limited(scope_key=scope_key, policy=policy)


def _extract_payload(request) -> Mapping[str, object]:
    """Reads parsed DRF payload first; falls back to raw-body parser."""
    try:
        data = getattr(request, "data", None)
    except (ParseError, UnsupportedMediaType):
        data = None
    if isinstance(data, Mapping):
        return data
    raw_request = getattr(request, "_request", request)
    return parse_request_payload(raw_request)


@ensure_csrf_cookie
@api_view(["GET"])
def csrf_token(request):
    """РћС‚РґР°РµС‚ CSRF token Рё РіР°СЂР°РЅС‚РёСЂСѓРµС‚ CSRF cookie."""
    return Response({"csrfToken": get_token(request)})


@ensure_csrf_cookie
@api_view(["GET"])
def session_view(request):
    """Р’РѕР·РІСЂР°С‰Р°РµС‚ С‚РµРєСѓС‰РµРµ СЃРѕСЃС‚РѕСЏРЅРёРµ СЃРµСЃСЃРёРё РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ."""
    user = getattr(request, "user", None)
    if user and user.is_authenticated:
        return Response({"authenticated": True, "user": _serialize_user(request, user)})
    return Response({"authenticated": False, "user": None})


@ensure_csrf_cookie
@api_view(["GET"])
def presence_session_view(request):
    """РРЅРёС†РёР°Р»РёР·РёСЂСѓРµС‚ guest session РґР»СЏ presence websocket."""
    if not request.session.session_key:
        request.session.create()
    request.session.modified = True
    audit_http_event("presence.session.bootstrap", request)
    return Response({"ok": True})


@csrf_protect
@api_view(["POST"])
def login_view(request):
    """Р›РѕРіРёРЅ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ РїРѕ username/password."""
    if _rate_limited(request, "login"):
        audit_http_event("auth.login.rate_limited", request)
        return error_response(status=429, error="РЎР»РёС€РєРѕРј РјРЅРѕРіРѕ РїРѕРїС‹С‚РѕРє")

    payload = _extract_payload(request)
    if not payload:
        audit_http_event("auth.login.failed", request, reason="empty_body")
        return error_response(
            status=400,
            error="РџСѓСЃС‚РѕРµ С‚РµР»Рѕ Р·Р°РїСЂРѕСЃР°",
            errors={"body": ["РџСѓСЃС‚РѕРµ С‚РµР»Рѕ Р·Р°РїСЂРѕСЃР°"]},
        )

    username = payload.get("username")
    password = payload.get("password")
    if not username or not password:
        audit_http_event("auth.login.failed", request, reason="missing_credentials")
        return error_response(
            status=400,
            error="РЈРєР°Р¶РёС‚Рµ Р»РѕРіРёРЅ Рё РїР°СЂРѕР»СЊ",
            errors={"credentials": ["РЈРєР°Р¶РёС‚Рµ Р»РѕРіРёРЅ Рё РїР°СЂРѕР»СЊ"]},
        )

    user = authenticate(request, username=username, password=password)
    if user is None:
        audit_http_event(
            "auth.login.failed",
            request,
            reason="invalid_credentials",
            attempted_username=username,
        )
        return error_response(
            status=400,
            error="РќРµРІРµСЂРЅС‹Р№ Р»РѕРіРёРЅ РёР»Рё РїР°СЂРѕР»СЊ",
            errors={"credentials": ["РќРµРІРµСЂРЅС‹Р№ Р»РѕРіРёРЅ РёР»Рё РїР°СЂРѕР»СЊ"]},
        )

    login(request, user)
    audit_http_event("auth.login.success", request, username=user.username)
    return Response({"authenticated": True, "user": _serialize_user(request, user)})


@csrf_protect
@api_view(["POST"])
def logout_view(request):
    """Р—Р°РІРµСЂС€Р°РµС‚ СЃРµСЃСЃРёСЋ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ Рё РѕР±РЅРѕРІР»СЏРµС‚ last_seen."""
    user = getattr(request, "user", None)
    if user and user.is_authenticated:
        try:
            profile = getattr(user, "profile", None)
            if profile:
                profile.last_seen = timezone.now() - timedelta(minutes=5)
                profile.save(update_fields=["last_seen"])
        except (OperationalError, ProgrammingError):
            pass

    logout(request)
    audit_http_event("auth.logout", request)
    return Response({"ok": True})


@csrf_protect
@api_view(["POST"])
def register_view(request):
    """Р РµРіРёСЃС‚СЂРёСЂСѓРµС‚ РЅРѕРІРѕРіРѕ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ."""

    if _rate_limited(request, "register"):
        audit_http_event("auth.register.rate_limited", request)
        return error_response(status=429, error="РЎР»РёС€РєРѕРј РјРЅРѕРіРѕ РїРѕРїС‹С‚РѕРє")

    payload = _extract_payload(request)
    if not payload:
        audit_http_event("auth.register.failed", request, reason="empty_body")
        return error_response(
            status=400,
            error="РџСѓСЃС‚РѕРµ С‚РµР»Рѕ Р·Р°РїСЂРѕСЃР°",
            errors={"body": ["РџСѓСЃС‚РѕРµ С‚РµР»Рѕ Р·Р°РїСЂРѕСЃР°"]},
        )

    username = payload.get("username")
    name_raw = payload.get("name")
    name = str(name_raw).strip() if name_raw is not None else ""
    last_name_raw = payload.get("last_name")
    last_name = str(last_name_raw).strip() if last_name_raw is not None else ""
    password1 = payload.get("password1")
    password2 = payload.get("password2")

    if not username:
        audit_http_event("auth.register.failed", request, reason="missing_username")
        return error_response(
            status=400,
            error="РЈРєР°Р¶РёС‚Рµ РёРјСЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ",
            errors={"username": ["РЈРєР°Р¶РёС‚Рµ РёРјСЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ"]},
        )
    if not name:
        audit_http_event("auth.register.failed", request, reason="missing_name", attempted_username=username)
        return error_response(
            status=400,
            error="РЈРєР°Р¶РёС‚Рµ РёРјСЏ",
            errors={"name": ["РЈРєР°Р¶РёС‚Рµ РёРјСЏ"]},
        )
    if User.objects.filter(username=username).exists():
        audit_http_event("auth.register.failed", request, reason="username_exists", attempted_username=username)
        return error_response(
            status=400,
            error="РРјСЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ СѓР¶Рµ Р·Р°РЅСЏС‚Рѕ",
            errors={"username": ["РРјСЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ СѓР¶Рµ Р·Р°РЅСЏС‚Рѕ"]},
        )
    if not password1 or not password2:
        audit_http_event("auth.register.failed", request, reason="missing_password")
        return error_response(
            status=400,
            error="РЈРєР°Р¶РёС‚Рµ РїР°СЂРѕР»СЊ",
            errors={"password": ["РЈРєР°Р¶РёС‚Рµ РїР°СЂРѕР»СЊ"]},
        )
    if password1 != password2:
        audit_http_event("auth.register.failed", request, reason="password_mismatch", attempted_username=username)
        return error_response(
            status=400,
            error="РџР°СЂРѕР»Рё РЅРµ СЃРѕРІРїР°РґР°СЋС‚",
            errors={"password": ["РџР°СЂРѕР»Рё РЅРµ СЃРѕРІРїР°РґР°СЋС‚"]},
        )

    form = UserRegisterForm(
        {
            "username": username,
            "password1": password1,
            "password2": password2,
            "name": name,
            "last_name": last_name,
        }
    )
    if form.is_valid():
        form.save()
        user = authenticate(request, username=payload.get("username"), password=payload.get("password1"))
        if user:
            login(request, user)
            audit_http_event("auth.register.success", request, username=user.username)
            return Response({"authenticated": True, "user": _serialize_user(request, user)}, status=201)
        audit_http_event("auth.register.success", request, username=username, authenticated=False)
        return Response({"ok": True}, status=201)

    errors = _collect_errors(form.errors)
    password_fields = {"password1", "password2"}
    if errors and password_fields.intersection(errors.keys()):
        errors.pop("password1", None)
        errors.pop("password2", None)
        errors["password"] = ["РџР°СЂРѕР»СЊ СЃР»РёС€РєРѕРј СЃР»Р°Р±С‹Р№"]
        audit_http_event("auth.register.failed", request, reason="weak_password", attempted_username=username)
        return error_response(
            status=400,
            error="РџР°СЂРѕР»СЊ СЃР»РёС€РєРѕРј СЃР»Р°Р±С‹Р№",
            errors=errors,
        )

    summary = " ".join(["; ".join(v) for v in errors.values()]) if errors else "РћС€РёР±РєР° РІР°Р»РёРґР°С†РёРё"
    audit_http_event("auth.register.failed", request, reason="validation_error", attempted_username=username, errors=errors)
    return error_response(status=400, error=summary, errors=errors)


@api_view(["GET"])
def password_rules(request):
    """Р’РѕР·РІСЂР°С‰Р°РµС‚ С‚РµРєСѓС‰РёРµ С‚СЂРµР±РѕРІР°РЅРёСЏ РІР°Р»РёРґР°С‚РѕСЂРѕРІ РїР°СЂРѕР»СЏ."""
    return Response({"rules": password_validation.password_validators_help_texts()})


@api_view(["GET"])
def media_view(request, file_path: str):
    """РћС‚РґР°РµС‚ media-С„Р°Р№Р» РїРѕ РїРѕРґРїРёСЃР°РЅРЅРѕРјСѓ URL С‡РµСЂРµР· X-Accel-Redirect."""
    normalized_path = normalize_media_path(file_path)
    if not normalized_path:
        return Response({"error": "РќРµ РЅР°Р№РґРµРЅРѕ"}, status=404)

    exp_raw = request.GET.get("exp")
    signature = request.GET.get("sig")
    try:
        expires_at = int(exp_raw)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        audit_http_event("media.signature.invalid", request, path=file_path, reason="invalid_exp")
        return Response({"error": "Р”РѕСЃС‚СѓРї Р·Р°РїСЂРµС‰РµРЅ"}, status=403)

    now = int(time.time())
    if expires_at < now:
        audit_http_event("media.signature.expired", request, path=normalized_path)
        return Response({"error": "Р”РѕСЃС‚СѓРї Р·Р°РїСЂРµС‰РµРЅ"}, status=403)

    if not is_valid_media_signature(normalized_path, expires_at, signature):
        audit_http_event("media.signature.invalid", request, path=normalized_path, reason="bad_signature")
        return Response({"error": "Р”РѕСЃС‚СѓРї Р·Р°РїСЂРµС‰РµРЅ"}, status=403)

    if not default_storage.exists(normalized_path):
        return Response({"error": "РќРµ РЅР°Р№РґРµРЅРѕ"}, status=404)

    cache_seconds = max(0, expires_at - now)
    if settings.DEBUG:
        response = FileResponse(default_storage.open(normalized_path, "rb"))
    else:
        response = HttpResponse()
        response["X-Accel-Redirect"] = f"/_protected_media/{quote(normalized_path, safe='/')}"

    response["Cache-Control"] = f"private, max-age={cache_seconds}"
    return response


@api_view(["GET"])
def public_profile_view(request, username: str):
    """Р’РѕР·РІСЂР°С‰Р°РµС‚ РїСѓР±Р»РёС‡РЅС‹Рµ РїРѕР»СЏ РїСЂРѕС„РёР»СЏ РїРѕ username."""
    if not username:
        return Response({"error": "РќРµ РЅР°Р№РґРµРЅРѕ"}, status=404)

    user = User.objects.filter(username=username).select_related("profile").first()
    if not user:
        return Response({"error": "РќРµ РЅР°Р№РґРµРЅРѕ"}, status=404)

    profile = getattr(user, "profile", None)
    profile_image = None
    if profile and getattr(profile, "image", None):
        image_name = getattr(profile.image, "name", "")
        if image_name:
            profile_image = build_profile_url_from_request(request, image_name)
    last_seen = getattr(profile, "last_seen", None)

    return Response(
        {
            "user": {
                "name": (user.first_name or "").strip(),
                "last_name": (user.last_name or "").strip(),
                "username": user.username,
                "email": "",
                "profileImage": profile_image,
                "avatarCrop": serialize_avatar_crop(profile),
                "bio": getattr(profile, "bio", "") or "",
                "lastSeen": last_seen.isoformat() if last_seen else None,
                "registeredAt": user.date_joined.isoformat() if getattr(user, "date_joined", None) else None,
            }
        }
    )


@csrf_protect
@api_view(["GET", "POST"])
def profile_view(request):
    """Р§РёС‚Р°РµС‚ Рё РѕР±РЅРѕРІР»СЏРµС‚ РїСЂРѕС„РёР»СЊ С‚РµРєСѓС‰РµРіРѕ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ."""
    user = getattr(request, "user", None)
    if not user or not user.is_authenticated:
        return error_response(status=401, error="РўСЂРµР±СѓРµС‚СЃСЏ Р°РІС‚РѕСЂРёР·Р°С†РёСЏ")

    if request.method == "GET":
        return Response({"user": _serialize_user(request, user)})

    payload = _extract_payload(request)
    u_form = UserUpdateForm(payload, instance=user)
    p_form = ProfileUpdateForm(payload, request.FILES, instance=user.profile)

    if u_form.is_valid() and p_form.is_valid():
        try:
            u_form.save()
            p_form.save()
        except IntegrityError:
            errors = {"username": ["РРјСЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ СѓР¶Рµ Р·Р°РЅСЏС‚Рѕ"]}
            audit_http_event("auth.profile.update.failed", request, username=user.username, errors=errors)
            return error_response(status=400, errors=errors)
        audit_http_event("auth.profile.update.success", request, username=user.username)
        return Response({"user": _serialize_user(request, user)})

    errors = _collect_errors(u_form.errors, p_form.errors)
    audit_http_event("auth.profile.update.failed", request, username=user.username, errors=errors)
    return error_response(status=400, errors=errors)


@method_decorator(csrf_protect, name="dispatch")
class LoginInteractiveView(GenericAPIView):
    permission_classes = [AllowAny]
    serializer_class = LoginSerializer

    def get(self, _request):
        return error_response(status=200, detail="РСЃРїРѕР»СЊР·СѓР№С‚Рµ POST СЃ РїРѕР»СЏРјРё username Рё password")

    def post(self, request):
        if _rate_limited(request, "login"):
            audit_http_event("auth.login.rate_limited", request)
            return error_response(status=429, error="РЎР»РёС€РєРѕРј РјРЅРѕРіРѕ РїРѕРїС‹С‚РѕРє")

        payload = _extract_payload(request)
        if not payload:
            audit_http_event("auth.login.failed", request, reason="empty_body")
            return error_response(
                status=400,
                error="РџСѓСЃС‚РѕРµ С‚РµР»Рѕ Р·Р°РїСЂРѕСЃР°",
                errors={"body": ["РџСѓСЃС‚РѕРµ С‚РµР»Рѕ Р·Р°РїСЂРѕСЃР°"]},
            )

        username = payload.get("username")
        password = payload.get("password")
        if not username or not password:
            audit_http_event("auth.login.failed", request, reason="missing_credentials")
            return error_response(
                status=400,
                error="РЈРєР°Р¶РёС‚Рµ Р»РѕРіРёРЅ Рё РїР°СЂРѕР»СЊ",
                errors={"credentials": ["РЈРєР°Р¶РёС‚Рµ Р»РѕРіРёРЅ Рё РїР°СЂРѕР»СЊ"]},
            )

        user = authenticate(request, username=username, password=password)
        if user is None:
            audit_http_event(
                "auth.login.failed",
                request,
                reason="invalid_credentials",
                attempted_username=username,
            )
            return error_response(
                status=400,
                error="РќРµРІРµСЂРЅС‹Р№ Р»РѕРіРёРЅ РёР»Рё РїР°СЂРѕР»СЊ",
                errors={"credentials": ["РќРµРІРµСЂРЅС‹Р№ Р»РѕРіРёРЅ РёР»Рё РїР°СЂРѕР»СЊ"]},
            )

        login(request, user)
        audit_http_event("auth.login.success", request, username=user.username)
        return Response({"authenticated": True, "user": _serialize_user(request, user)})


@method_decorator(csrf_protect, name="dispatch")
class LogoutInteractiveView(GenericAPIView):
    permission_classes = [AllowAny]
    serializer_class = LogoutSerializer

    def get(self, _request):
        return error_response(status=200, detail="РСЃРїРѕР»СЊР·СѓР№С‚Рµ POST РґР»СЏ РІС‹С…РѕРґР°")

    def post(self, request):
        user = getattr(request, "user", None)
        if user and user.is_authenticated:
            try:
                profile = getattr(user, "profile", None)
                if profile:
                    profile.last_seen = timezone.now() - timedelta(minutes=5)
                    profile.save(update_fields=["last_seen"])
            except (OperationalError, ProgrammingError):
                pass

        logout(request)
        audit_http_event("auth.logout", request)
        return Response({"ok": True})


@method_decorator(csrf_protect, name="dispatch")
class RegisterInteractiveView(GenericAPIView):
    permission_classes = [AllowAny]
    serializer_class = RegisterSerializer

    def get(self, _request):
        return error_response(status=200, detail="Используйте POST с полями name, last_name (опционально), username, password1, password2")

    def post(self, request):
        if _rate_limited(request, "register"):
            audit_http_event("auth.register.rate_limited", request)
            return error_response(status=429, error="РЎР»РёС€РєРѕРј РјРЅРѕРіРѕ РїРѕРїС‹С‚РѕРє")

        payload = _extract_payload(request)
        if not payload:
            audit_http_event("auth.register.failed", request, reason="empty_body")
            return error_response(
                status=400,
                error="РџСѓСЃС‚РѕРµ С‚РµР»Рѕ Р·Р°РїСЂРѕСЃР°",
                errors={"body": ["РџСѓСЃС‚РѕРµ С‚РµР»Рѕ Р·Р°РїСЂРѕСЃР°"]},
            )

        username = payload.get("username")
        name_raw = payload.get("name")
        name = str(name_raw).strip() if name_raw is not None else ""
        last_name_raw = payload.get("last_name")
        last_name = str(last_name_raw).strip() if last_name_raw is not None else ""
        password1 = payload.get("password1")
        password2 = payload.get("password2")

        if not username:
            audit_http_event("auth.register.failed", request, reason="missing_username")
            return error_response(
                status=400,
                error="РЈРєР°Р¶РёС‚Рµ РёРјСЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ",
                errors={"username": ["РЈРєР°Р¶РёС‚Рµ РёРјСЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ"]},
            )
        if not name:
            audit_http_event("auth.register.failed", request, reason="missing_name", attempted_username=username)
            return error_response(
                status=400,
                error="РЈРєР°Р¶РёС‚Рµ РёРјСЏ",
                errors={"name": ["РЈРєР°Р¶РёС‚Рµ РёРјСЏ"]},
            )
        if User.objects.filter(username=username).exists():
            audit_http_event("auth.register.failed", request, reason="username_exists", attempted_username=username)
            return error_response(
                status=400,
                error="РРјСЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ СѓР¶Рµ Р·Р°РЅСЏС‚Рѕ",
                errors={"username": ["РРјСЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ СѓР¶Рµ Р·Р°РЅСЏС‚Рѕ"]},
            )
        if not password1 or not password2:
            audit_http_event("auth.register.failed", request, reason="missing_password")
            return error_response(
                status=400,
                error="РЈРєР°Р¶РёС‚Рµ РїР°СЂРѕР»СЊ",
                errors={"password": ["РЈРєР°Р¶РёС‚Рµ РїР°СЂРѕР»СЊ"]},
            )
        if password1 != password2:
            audit_http_event("auth.register.failed", request, reason="password_mismatch", attempted_username=username)
            return error_response(
                status=400,
                error="РџР°СЂРѕР»Рё РЅРµ СЃРѕРІРїР°РґР°СЋС‚",
                errors={"password": ["РџР°СЂРѕР»Рё РЅРµ СЃРѕРІРїР°РґР°СЋС‚"]},
            )

        form = UserRegisterForm(
            {
                "username": username,
                "password1": password1,
                "password2": password2,
                "name": name,
                "last_name": last_name,
            }
        )
        if form.is_valid():
            form.save()
            user = authenticate(request, username=payload.get("username"), password=payload.get("password1"))
            if user:
                login(request, user)
                audit_http_event("auth.register.success", request, username=user.username)
                return Response({"authenticated": True, "user": _serialize_user(request, user)}, status=201)
            audit_http_event("auth.register.success", request, username=username, authenticated=False)
            return Response({"ok": True}, status=201)

        errors = _collect_errors(form.errors)
        password_fields = {"password1", "password2"}
        if errors and password_fields.intersection(errors.keys()):
            errors.pop("password1", None)
            errors.pop("password2", None)
            errors["password"] = ["РџР°СЂРѕР»СЊ СЃР»РёС€РєРѕРј СЃР»Р°Р±С‹Р№"]
            audit_http_event("auth.register.failed", request, reason="weak_password", attempted_username=username)
            return error_response(
                status=400,
                error="РџР°СЂРѕР»СЊ СЃР»РёС€РєРѕРј СЃР»Р°Р±С‹Р№",
                errors=errors,
            )

        summary = " ".join(["; ".join(v) for v in errors.values()]) if errors else "РћС€РёР±РєР° РІР°Р»РёРґР°С†РёРё"
        audit_http_event("auth.register.failed", request, reason="validation_error", attempted_username=username, errors=errors)
        return error_response(status=400, error=summary, errors=errors)


@method_decorator(csrf_protect, name="dispatch")
class ProfileInteractiveView(GenericAPIView):
    permission_classes = [AllowAny]
    serializer_class = ProfileUpdateSerializer

    def get(self, request):
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return error_response(status=401, error="РўСЂРµР±СѓРµС‚СЃСЏ Р°РІС‚РѕСЂРёР·Р°С†РёСЏ")
        return Response({"user": _serialize_user(request, user)})

    def post(self, request):
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return error_response(status=401, error="РўСЂРµР±СѓРµС‚СЃСЏ Р°РІС‚РѕСЂРёР·Р°С†РёСЏ")

        payload = _extract_payload(request)
        u_form = UserUpdateForm(payload, instance=user)
        p_form = ProfileUpdateForm(payload, request.FILES, instance=user.profile)

        if u_form.is_valid() and p_form.is_valid():
            try:
                u_form.save()
                p_form.save()
            except IntegrityError:
                errors = {"username": ["РРјСЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ СѓР¶Рµ Р·Р°РЅСЏС‚Рѕ"]}
                audit_http_event("auth.profile.update.failed", request, username=user.username, errors=errors)
                return error_response(status=400, errors=errors)
            audit_http_event("auth.profile.update.success", request, username=user.username)
            return Response({"user": _serialize_user(request, user)})

        errors = _collect_errors(u_form.errors, p_form.errors)
        audit_http_event("auth.profile.update.failed", request, username=user.username, errors=errors)
        return error_response(status=400, errors=errors)


login_view = LoginInteractiveView.as_view()
logout_view = LogoutInteractiveView.as_view()
register_view = RegisterInteractiveView.as_view()
profile_view = ProfileInteractiveView.as_view()

