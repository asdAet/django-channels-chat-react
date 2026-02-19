"""Общие HTTP-утилиты для API-слоя: парсинг payload и единые ошибки."""

from __future__ import annotations

import json
from collections.abc import Mapping

from django.http import JsonResponse
from django.http.request import RawPostDataException


def parse_request_payload(request) -> Mapping[str, object]:
    """Возвращает словарь payload из JSON или form-data без выбрасывания ошибок наружу."""
    content_type = request.META.get("CONTENT_TYPE", "")
    if content_type.startswith("multipart/form-data") or content_type.startswith(
        "application/x-www-form-urlencoded"
    ):
        return request.POST if request.POST else {}

    try:
        raw_body = request.body
    except RawPostDataException:
        return request.POST if request.POST else {}

    if raw_body:
        try:
            payload = json.loads(raw_body)
            if isinstance(payload, dict):
                return payload
        except json.JSONDecodeError:
            pass

    return request.POST if request.POST else {}


def error_response(
    *,
    status: int,
    error: str | None = None,
    detail: str | None = None,
    errors: Mapping[str, list[str] | str] | None = None,
) -> JsonResponse:
    """Формирует единый JSON-ответ ошибки в формате error/detail/errors."""
    payload: dict[str, object] = {}
    if error:
        payload["error"] = error
    if detail:
        payload["detail"] = detail
    if errors:
        payload["errors"] = errors
    return JsonResponse(payload, status=status)
