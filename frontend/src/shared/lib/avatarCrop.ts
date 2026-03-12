import type { CSSProperties } from "react";

import type { AvatarCrop } from "../api/users";

const EPSILON = 0.000001;

export const normalizeAvatarCrop = (
  value?: AvatarCrop | null,
): AvatarCrop | null => {
  if (!value) return null;

  const { x, y, width, height } = value;
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height)
  ) {
    return null;
  }

  if (x < 0 || y < 0 || width <= 0 || height <= 0) {
    return null;
  }

  if (x >= 1 || y >= 1 || width > 1 || height > 1) {
    return null;
  }

  if (x + width > 1 + EPSILON || y + height > 1 + EPSILON) {
    return null;
  }

  return {
    x,
    y,
    width,
    height,
  };
};

export const buildAvatarCropImageStyle = (crop: AvatarCrop): CSSProperties => ({
  width: `${100 / crop.width}%`,
  height: `${100 / crop.height}%`,
  left: `-${(crop.x / crop.width) * 100}%`,
  top: `-${(crop.y / crop.height) * 100}%`,
  objectFit: "fill",
  borderRadius: 0,
  maxWidth: "none",
});
