"""Thumbnail generation for chat image attachments."""

from __future__ import annotations

import io
import logging
from pathlib import Path

from django.conf import settings
from django.core.files.base import ContentFile

logger = logging.getLogger(__name__)


def generate_thumbnail(source_field) -> dict | None:
    """Generate a thumbnail for an image file field.

    Returns dict with 'path' (ContentFile), 'width', 'height' or None on failure.
    """
    try:
        from PIL import Image
    except ImportError:
        logger.warning("Pillow not installed — skipping thumbnail generation")
        return None

    max_side = int(getattr(settings, "CHAT_THUMBNAIL_MAX_SIDE", 400))

    try:
        source_field.seek(0)
        img = Image.open(source_field)
        img.verify()
        source_field.seek(0)
        img = Image.open(source_field)
    except Exception:
        logger.debug("Cannot open image for thumbnail", exc_info=True)
        return None

    original_width, original_height = img.size
    if original_width <= max_side and original_height <= max_side:
        return {
            "path": None,
            "width": original_width,
            "height": original_height,
        }

    ratio = min(max_side / original_width, max_side / original_height)
    new_size = (int(original_width * ratio), int(original_height * ratio))

    try:
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGBA")
            fmt = "PNG"
            ext = "png"
        else:
            img = img.convert("RGB")
            fmt = "JPEG"
            ext = "jpg"

        resampling = getattr(Image, "Resampling", None)
        if resampling is not None:
            resize_filter = getattr(resampling, "LANCZOS", 1)
        else:
            resize_filter = getattr(Image, "LANCZOS", 1)

        img = img.resize(new_size, resize_filter)
        buf = io.BytesIO()
        img.save(buf, format=fmt, quality=85)
        buf.seek(0)

        stem = Path(source_field.name).stem if source_field.name else "thumb"
        filename = f"thumb_{stem}.{ext}"

        return {
            "path": ContentFile(buf.read(), name=filename),
            "width": new_size[0],
            "height": new_size[1],
        }
    except Exception:
        logger.debug("Thumbnail generation failed", exc_info=True)
        return None
