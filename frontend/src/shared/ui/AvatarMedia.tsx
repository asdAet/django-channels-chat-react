import type { ImgHTMLAttributes } from "react";

import type { AvatarCrop } from "../api/users";
import {
  buildAvatarCropImageStyle,
  normalizeAvatarCrop,
} from "../lib/avatarCrop";

import styles from "../../styles/ui/AvatarMedia.module.css";

type AvatarMediaProps = {
  src: string;
  alt: string;
  avatarCrop?: AvatarCrop | null;
  loading?: ImgHTMLAttributes<HTMLImageElement>["loading"];
  decoding?: ImgHTMLAttributes<HTMLImageElement>["decoding"];
  draggable?: boolean;
  className?: string;
  onError?: ImgHTMLAttributes<HTMLImageElement>["onError"];
};

export function AvatarMedia({
  src,
  alt,
  avatarCrop = null,
  loading = "lazy",
  decoding = "async",
  draggable = false,
  className,
  onError,
}: AvatarMediaProps) {
  const crop = normalizeAvatarCrop(avatarCrop);
  const imageClassName = [styles.image, className].filter(Boolean).join(" ");

  if (!crop) {
    return (
      <img
        src={src}
        alt={alt}
        loading={loading}
        decoding={decoding}
        draggable={draggable}
        className={imageClassName}
        onError={onError}
      />
    );
  }

  return (
    <span className={styles.frame}>
      <img
        src={src}
        alt={alt}
        loading={loading}
        decoding={decoding}
        draggable={draggable}
        className={[styles.image, styles.croppedImage, className]
          .filter(Boolean)
          .join(" ")}
        style={buildAvatarCropImageStyle(crop)}
        onError={onError}
      />
    </span>
  );
}
