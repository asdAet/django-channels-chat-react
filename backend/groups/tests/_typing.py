"""Typing helpers for groups API tests."""

from __future__ import annotations

from typing import Any

from rest_framework.test import APIClient


class TypedAPIClient(APIClient):
    """APIClient that returns Any for request methods to satisfy static typing."""

    def get(self, *args: Any, **kwargs: Any) -> Any:
        return super().get(*args, **kwargs)

    def post(self, *args: Any, **kwargs: Any) -> Any:
        return super().post(*args, **kwargs)

    def patch(self, *args: Any, **kwargs: Any) -> Any:
        return super().patch(*args, **kwargs)

    def delete(self, *args: Any, **kwargs: Any) -> Any:
        return super().delete(*args, **kwargs)
