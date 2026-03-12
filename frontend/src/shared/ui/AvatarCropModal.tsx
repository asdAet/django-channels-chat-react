import { useEffect, useRef, useState } from "react";

import Cropper, { type Area, type MediaSize } from "react-easy-crop";

import type { AvatarCrop } from "../api/users";
import { Button } from "./Button";

import styles from "../../styles/ui/AvatarCropModal.module.css";

type AvatarCropModalProps = {
  open: boolean;
  image: string | null;
  onCancel: () => void;
  onApply: (crop: AvatarCrop) => void;
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.01;
const EPSILON = 0.000001;
const ROUND_FACTOR = 1_000_000;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
const roundToSix = (value: number) =>
  Math.round(value * ROUND_FACTOR) / ROUND_FACTOR;

const toNormalizedCrop = (
  areaPixels: Area | null,
  mediaSize: MediaSize | null,
): AvatarCrop => {
  if (!areaPixels || !mediaSize) {
    return { x: 0, y: 0, width: 1, height: 1 };
  }

  const naturalWidth = mediaSize.naturalWidth || mediaSize.width;
  const naturalHeight = mediaSize.naturalHeight || mediaSize.height;
  if (naturalWidth <= 0 || naturalHeight <= 0) {
    return { x: 0, y: 0, width: 1, height: 1 };
  }

  let width = clamp(areaPixels.width / naturalWidth, EPSILON, 1);
  let height = clamp(areaPixels.height / naturalHeight, EPSILON, 1);
  let x = clamp(areaPixels.x / naturalWidth, 0, Math.max(0, 1 - width));
  let y = clamp(areaPixels.y / naturalHeight, 0, Math.max(0, 1 - height));

  width = clamp(roundToSix(width), EPSILON, 1);
  height = clamp(roundToSix(height), EPSILON, 1);
  x = clamp(roundToSix(x), 0, Math.max(0, 1 - width));
  y = clamp(roundToSix(y), 0, Math.max(0, 1 - height));

  if (x + width > 1) {
    x = Math.max(0, roundToSix(1 - width));
  }
  if (y + height > 1) {
    y = Math.max(0, roundToSix(1 - height));
  }

  return { x, y, width, height };
};

export function AvatarCropModal({
  open,
  image,
  onCancel,
  onApply,
}: AvatarCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const croppedAreaPixelsRef = useRef<Area | null>(null);
  const mediaSizeRef = useRef<MediaSize | null>(null);

  useEffect(() => {
    croppedAreaPixelsRef.current = null;
    mediaSizeRef.current = null;
  }, [image]);

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open || !image) {
    return null;
  }

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label="Редактор аватарки"
    >
      <div
        className={styles.modal}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>Новая аватарка</h2>
            <p className={styles.subtitle}>
              Перемещайте изображение внутри круглой области.
            </p>
          </div>
        </div>

        <div className={styles.cropStage}>
          <Cropper
            image={image}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            objectFit="cover"
            restrictPosition
            style={{ cropAreaStyle: { width: "100%", height: "100%" } }}
            onCropChange={setCrop}
            onZoomChange={(value) => setZoom(clamp(value, MIN_ZOOM, MAX_ZOOM))}
            onMediaLoaded={(nextMediaSize) => {
              mediaSizeRef.current = nextMediaSize;
            }}
            onCropComplete={(_, nextCroppedAreaPixels) => {
              croppedAreaPixelsRef.current = nextCroppedAreaPixels;
            }}
          />
        </div>

        <label className={styles.zoomControl}>
          <span>Масштаб</span>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={ZOOM_STEP}
            value={zoom}
            onChange={(event) =>
              setZoom(clamp(Number(event.target.value), MIN_ZOOM, MAX_ZOOM))
            }
          />
        </label>

        <div className={styles.actions}>
          <Button variant="ghost" onClick={onCancel}>
            Отмена
          </Button>
          <Button
            variant="primary"
            onClick={() =>
              onApply(
                toNormalizedCrop(
                  croppedAreaPixelsRef.current,
                  mediaSizeRef.current,
                ),
              )
            }
          >
            Применить
          </Button>
        </div>
      </div>
    </div>
  );
}
