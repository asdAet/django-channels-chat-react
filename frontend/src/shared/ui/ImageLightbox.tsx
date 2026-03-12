import { useCallback, useEffect, useState } from "react";

import styles from "../../styles/ui/ImageLightbox.module.css";

type Props = {
  src: string;
  alt?: string;
  onClose: () => void;
};

export function ImageLightbox({ src, alt, onClose }: Props) {
  const [exiting, setExiting] = useState(false);

  const dismiss = useCallback(() => {
    setExiting(true);
    window.setTimeout(onClose, 200);
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [dismiss]);

  return (
    <div
      className={[styles.overlay, exiting ? styles.exiting : ""]
        .filter(Boolean)
        .join(" ")}
      onClick={dismiss}
      role="dialog"
      aria-label="Просмотр изображения"
    >
      <img
        src={src}
        alt={alt ?? "Изображение"}
        className={styles.image}
        onClick={(e) => e.stopPropagation()}
      />
      <button
        type="button"
        className={styles.closeBtn}
        onClick={dismiss}
        aria-label="Закрыть"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
