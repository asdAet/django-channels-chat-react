"""API пользователей: auth/session/profile/media endpoints."""

from __future__ import annotations

import time
from datetime import timedelta
from urllib.parse import quote

from django.conf import settings
from django.contrib.auth import authenticate, login, logout, password_validation
from django.contrib.auth.models import User
from django.core.files.storage import default_storage
from django.db import OperationalError, ProgrammingError
from django.http import FileResponse, HttpResponse, JsonResponse
from django.middleware.csrf import get_token
from django.utils import timezone
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_http_methods

from chat.utils import (
    build_profile_url_from_request,
    is_valid_media_signature,
    normalize_media_path,
)
from chat_app_django.http_utils import error_response, parse_request_payload
from chat_app_django.ip_utils import get_client_ip_from_request
from chat_app_django.security.audit import audit_http_event
from chat_app_django.security.rate_limit import DbRateLimiter, RateLimitPolicy

from .forms import ProfileUpdateForm, UserRegisterForm, UserUpdateForm


def _serialize_user(request, user):
    """Сериализует пользователя в единый формат auth/profile API."""
    profile = getattr(user, "profile", None)
    profile_image = None
    if profile and getattr(profile, "image", None):
        image_name = getattr(profile.image, "name", "")
        if image_name:
            profile_image = build_profile_url_from_request(request, image_name)

    return {
        "username": user.username,
        "email": user.email,
        "profileImage": profile_image,
        "bio": getattr(profile, "bio", "") or "",
        "lastSeen": profile.last_seen.isoformat() if getattr(profile, "last_seen", None) else None,
        "registeredAt": user.date_joined.isoformat() if getattr(user, "date_joined", None) else None,
    }


def _collect_errors(*errors):
    """Объединяет ValidationError-словари из нескольких форм."""
    combined = {}
    for error_dict in errors:
        for field, messages in error_dict.items():
            combined[field] = list(messages)
    return combined


def _get_client_ip(request) -> str:
    """Возвращает IP клиента с учетом trusted proxy."""
    return get_client_ip_from_request(request) or ""


def _rate_limited(request, action: str) -> bool:
    """Проверяет auth rate-limit через персистентный DB-limiter."""
    limit = int(getattr(settings, "AUTH_RATE_LIMIT", 10))
    window = int(getattr(settings, "AUTH_RATE_WINDOW", 60))
    ip = _get_client_ip(request) or "unknown"
    scope_key = f"rl:auth:{action}:{ip}"
    policy = RateLimitPolicy(limit=limit, window_seconds=window)
    return DbRateLimiter.is_limited(scope_key=scope_key, policy=policy)


@ensure_csrf_cookie
@require_http_methods(["GET"])
def csrf_token(request):
    """Отдает CSRF token и гарантирует CSRF cookie."""
    return JsonResponse({"csrfToken": get_token(request)})


@ensure_csrf_cookie
@require_http_methods(["GET"])
def session_view(request):
    """Возвращает текущее состояние сессии пользователя."""
    if request.user.is_authenticated:
        return JsonResponse({"authenticated": True, "user": _serialize_user(request, request.user)})
    return JsonResponse({"authenticated": False, "user": None})


@ensure_csrf_cookie
@require_http_methods(["GET"])
def presence_session_view(request):
    """Инициализирует guest session для presence websocket."""
    if not request.session.session_key:
        request.session.create()
    request.session.modified = True
    audit_http_event("presence.session.bootstrap", request)
    return JsonResponse({"ok": True})


@require_http_methods(["POST"])
def login_view(request):
    """Логин пользователя по username/password."""
    if _rate_limited(request, "login"):
        audit_http_event("auth.login.rate_limited", request)
        return error_response(status=429, error="Too many attempts")

    payload = parse_request_payload(request)
    if not payload:
        audit_http_event("auth.login.failed", request, reason="empty_body")
        return error_response(
            status=400,
            error="Пустое тело запроса",
            errors={"body": ["Пустое тело запроса"]},
        )

    username = payload.get("username")
    password = payload.get("password")
    if not username or not password:
        audit_http_event("auth.login.failed", request, reason="missing_credentials")
        return error_response(
            status=400,
            error="Укажите логин и пароль",
            errors={"credentials": ["Укажите логин и пароль"]},
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
            error="Неверный логин или пароль",
            errors={"credentials": ["Неверный логин или пароль"]},
        )

    login(request, user)
    audit_http_event("auth.login.success", request, username=user.username)
    return JsonResponse({"authenticated": True, "user": _serialize_user(request, user)})


@require_http_methods(["POST"])
def logout_view(request):
    """Завершает сессию пользователя и обновляет last_seen."""
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
    return JsonResponse({"ok": True})


@require_http_methods(["GET", "POST"])
def register_view(request):
    """Регистрирует нового пользователя."""
    if request.method == "GET":
        return error_response(
            status=200,
            detail="Используйте POST с полями username, password1, password2",
        )

    if _rate_limited(request, "register"):
        audit_http_event("auth.register.rate_limited", request)
        return error_response(status=429, error="Too many attempts")

    payload = parse_request_payload(request)
    if not payload:
        audit_http_event("auth.register.failed", request, reason="empty_body")
        return error_response(
            status=400,
            error="Пустое тело запроса",
            errors={"body": ["Пустое тело запроса"]},
        )

    username = payload.get("username")
    password1 = payload.get("password1")
    password2 = payload.get("password2")

    if not username:
        audit_http_event("auth.register.failed", request, reason="missing_username")
        return error_response(
            status=400,
            error="Укажите имя пользователя",
            errors={"username": ["Укажите имя пользователя"]},
        )
    if User.objects.filter(username=username).exists():
        audit_http_event("auth.register.failed", request, reason="username_exists", attempted_username=username)
        return error_response(
            status=400,
            error="Имя пользователя уже занято",
            errors={"username": ["Имя пользователя уже занято"]},
        )
    if not password1 or not password2:
        audit_http_event("auth.register.failed", request, reason="missing_password")
        return error_response(
            status=400,
            error="Укажите пароль",
            errors={"password": ["Укажите пароль"]},
        )
    if password1 != password2:
        audit_http_event("auth.register.failed", request, reason="password_mismatch", attempted_username=username)
        return error_response(
            status=400,
            error="Пароли не совпадают",
            errors={"password": ["Пароли не совпадают"]},
        )

    form = UserRegisterForm({"username": username, "password1": password1, "password2": password2})
    if form.is_valid():
        form.save()
        user = authenticate(request, username=payload.get("username"), password=payload.get("password1"))
        if user:
            login(request, user)
            audit_http_event("auth.register.success", request, username=user.username)
            return JsonResponse({"authenticated": True, "user": _serialize_user(request, user)}, status=201)
        audit_http_event("auth.register.success", request, username=username, authenticated=False)
        return JsonResponse({"ok": True}, status=201)

    errors = _collect_errors(form.errors)
    password_fields = {"password1", "password2"}
    if errors and password_fields.intersection(errors.keys()):
        errors.pop("password1", None)
        errors.pop("password2", None)
        errors["password"] = ["Пароль слишком слабый"]
        audit_http_event("auth.register.failed", request, reason="weak_password", attempted_username=username)
        return error_response(
            status=400,
            error="Пароль слишком слабый",
            errors=errors,
        )

    summary = " ".join(["; ".join(v) for v in errors.values()]) if errors else "Ошибка валидации"
    audit_http_event("auth.register.failed", request, reason="validation_error", attempted_username=username, errors=errors)
    return error_response(status=400, error=summary, errors=errors)


@require_http_methods(["GET"])
def password_rules(request):
    """Возвращает текущие требования валидаторов пароля."""
    return JsonResponse({"rules": password_validation.password_validators_help_texts()})


@require_http_methods(["GET"])
def media_view(request, file_path: str):
    """Отдает media-файл по подписанному URL через X-Accel-Redirect."""
    normalized_path = normalize_media_path(file_path)
    if not normalized_path:
        return JsonResponse({"error": "Not found"}, status=404)

    exp_raw = request.GET.get("exp")
    signature = request.GET.get("sig")
    try:
        expires_at = int(exp_raw)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        audit_http_event("media.signature.invalid", request, path=file_path, reason="invalid_exp")
        return JsonResponse({"error": "Forbidden"}, status=403)

    now = int(time.time())
    if expires_at < now:
        audit_http_event("media.signature.expired", request, path=normalized_path)
        return JsonResponse({"error": "Forbidden"}, status=403)

    if not is_valid_media_signature(normalized_path, expires_at, signature):
        audit_http_event("media.signature.invalid", request, path=normalized_path, reason="bad_signature")
        return JsonResponse({"error": "Forbidden"}, status=403)

    if not default_storage.exists(normalized_path):
        return JsonResponse({"error": "Not found"}, status=404)

    cache_seconds = max(0, expires_at - now)
    if settings.DEBUG:
        response = FileResponse(default_storage.open(normalized_path, "rb"))
    else:
        response = HttpResponse()
        response["X-Accel-Redirect"] = f"/_protected_media/{quote(normalized_path, safe='/')}"

    response["Cache-Control"] = f"private, max-age={cache_seconds}"
    return response


@require_http_methods(["GET"])
def public_profile_view(request, username: str):
    """Возвращает публичные поля профиля по username."""
    if not username:
        return JsonResponse({"error": "Not found"}, status=404)

    user = User.objects.filter(username=username).select_related("profile").first()
    if not user:
        return JsonResponse({"error": "Not found"}, status=404)

    profile = getattr(user, "profile", None)
    profile_image = None
    if profile and getattr(profile, "image", None):
        image_name = getattr(profile.image, "name", "")
        if image_name:
            profile_image = build_profile_url_from_request(request, image_name)

    return JsonResponse(
        {
            "user": {
                "username": user.username,
                "email": "",
                "profileImage": profile_image,
                "bio": getattr(profile, "bio", "") or "",
                "lastSeen": profile.last_seen.isoformat() if getattr(profile, "last_seen", None) else None,
                "registeredAt": user.date_joined.isoformat() if getattr(user, "date_joined", None) else None,
            }
        }
    )


@require_http_methods(["GET", "POST"])
def profile_view(request):
    """Читает и обновляет профиль текущего пользователя."""
    if not request.user.is_authenticated:
        return error_response(status=401, error="Требуется авторизация")

    if request.method == "GET":
        return JsonResponse({"user": _serialize_user(request, request.user)})

    payload = parse_request_payload(request)
    u_form = UserUpdateForm(payload, instance=request.user)
    p_form = ProfileUpdateForm(payload, request.FILES, instance=request.user.profile)

    if u_form.is_valid() and p_form.is_valid():
        u_form.save()
        p_form.save()
        audit_http_event("auth.profile.update.success", request, username=request.user.username)
        return JsonResponse({"user": _serialize_user(request, request.user)})

    errors = _collect_errors(u_form.errors, p_form.errors)
    audit_http_event("auth.profile.update.failed", request, username=request.user.username, errors=errors)
    return error_response(status=400, errors=errors)
