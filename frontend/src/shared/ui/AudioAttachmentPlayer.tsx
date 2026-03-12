import { useCallback, useMemo, useRef, useState } from "react";

import styles from "../../styles/ui/AudioAttachmentPlayer.module.css";

type Props = {
  src: string;
  title?: string;
  subtitle?: string;
  downloadName?: string;
  compact?: boolean;
  className?: string;
};

type PlaybackState = {
  srcKey: string;
  isReady: boolean;
  isPlaying: boolean;
  duration: number;
  currentTime: number;
  hasError: boolean;
};

const normalizeTime = (value: number) =>
  Number.isFinite(value) && value > 0 ? value : 0;

const createInitialPlaybackState = (srcKey: string): PlaybackState => ({
  srcKey,
  isReady: false,
  isPlaying: false,
  duration: 0,
  currentTime: 0,
  hasError: false,
});

const formatTime = (value: number) => {
  const total = Math.max(0, Math.floor(normalizeTime(value)));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

export function AudioAttachmentPlayer({
  src,
  title,
  subtitle,
  downloadName,
  compact = false,
  className,
}: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackState>(() =>
    createInitialPlaybackState(src),
  );

  const currentState =
    playbackState.srcKey === src
      ? playbackState
      : createInitialPlaybackState(src);

  const patchState = useCallback(
    (patch: Partial<Omit<PlaybackState, "srcKey">>) => {
      setPlaybackState((prev) => {
        const base =
          prev.srcKey === src ? prev : createInitialPlaybackState(src);
        return { ...base, ...patch, srcKey: src };
      });
    },
    [src],
  );

  const handleToggle = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || currentState.hasError) return;

    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        patchState({ hasError: true, isPlaying: false });
      }
      return;
    }

    audio.pause();
  }, [currentState.hasError, patchState]);

  const handleSeek = useCallback(
    (nextValue: number) => {
      const audio = audioRef.current;
      if (!audio || !Number.isFinite(nextValue)) return;
      audio.currentTime = nextValue;
      patchState({ currentTime: nextValue });
    },
    [patchState],
  );

  const durationLabel = formatTime(currentState.duration);
  const currentLabel = formatTime(currentState.currentTime);
  const progressMax = useMemo(
    () => (currentState.duration > 0 ? currentState.duration : 0),
    [currentState.duration],
  );
  const progressValue = Math.min(currentState.currentTime, progressMax);

  return (
    <div
      className={[styles.root, compact ? styles.compact : "", className ?? ""]
        .filter(Boolean)
        .join(" ")}
      data-testid="audio-attachment-player"
    >
      <audio
        key={src}
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(event) => {
          const duration = normalizeTime(event.currentTarget.duration);
          patchState({
            duration,
            currentTime: 0,
            isReady: true,
            hasError: false,
          });
        }}
        onTimeUpdate={(event) => {
          patchState({
            currentTime: normalizeTime(event.currentTarget.currentTime),
          });
        }}
        onPlay={() => patchState({ isPlaying: true })}
        onPause={() => patchState({ isPlaying: false })}
        onEnded={() => patchState({ isPlaying: false, currentTime: 0 })}
        onError={() =>
          patchState({ hasError: true, isPlaying: false, isReady: false })
        }
      />

      <div className={styles.mainRow}>
        <button
          type="button"
          className={styles.playButton}
          onClick={() => void handleToggle()}
          disabled={currentState.hasError}
          aria-label={currentState.isPlaying ? "Пауза" : "Воспроизвести"}
          title={currentState.isPlaying ? "Пауза" : "Воспроизвести"}
        >
          {currentState.isPlaying ? "Pause" : "Play"}
        </button>

        <div className={styles.meta}>
          {title && (
            <span className={styles.title} title={title}>
              {title}
            </span>
          )}
          {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
        </div>

        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          download={downloadName}
          className={styles.downloadButton}
        >
          Скачать
        </a>
      </div>

      <div className={styles.controlsRow}>
        <input
          type="range"
          className={styles.progress}
          min={0}
          max={progressMax}
          step={0.1}
          value={progressValue}
          disabled={
            !currentState.isReady || currentState.hasError || progressMax <= 0
          }
          onChange={(event) => {
            const parsed = Number(event.currentTarget.value);
            if (Number.isFinite(parsed)) handleSeek(parsed);
          }}
          aria-label="Позиция воспроизведения"
        />
        <span className={styles.timeLabel}>
          {currentLabel} / {durationLabel}
        </span>
      </div>

      {currentState.hasError && (
        <p className={styles.errorText}>
          Не удалось воспроизвести аудио в браузере. Используйте кнопку
          «Скачать».
        </p>
      )}
    </div>
  );
}
