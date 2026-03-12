import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";

import type { Message } from "../../entities/message/types";
import styles from "../../styles/chat/MessageInput.module.css";

type Props = {
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onTyping?: () => void;
  disabled?: boolean;
  rateLimitActive?: boolean;
  rateLimitSeconds?: number;
  replyTo?: Message | null;
  onCancelReply?: () => void;
  onAttach?: (files: File[]) => void;
  pendingFiles?: File[];
  onRemovePendingFile?: (index: number) => void;
  onClearPendingFiles?: () => void;
  uploadProgress?: number | null;
  onCancelUpload?: () => void;
};

const IconAttach = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </svg>
);

const IconSend = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const IconClose = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export function MessageInput({
  draft,
  onDraftChange,
  onSend,
  onTyping,
  disabled,
  rateLimitActive,
  rateLimitSeconds,
  replyTo,
  onCancelReply,
  onAttach,
  pendingFiles = [],
  onRemovePendingFile,
  onClearPendingFiles,
  uploadProgress,
  onCancelUpload,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      onDraftChange(e.target.value);
      onTyping?.();
    },
    [onDraftChange, onTyping],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onSend();
      }
    },
    [onSend],
  );

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files?.length) return;
      onAttach?.(Array.from(files));
      e.target.value = "";
    },
    [onAttach],
  );

  const uploading = uploadProgress !== null && uploadProgress !== undefined;
  const hasQueuedFiles = pendingFiles.length > 0;
  const canSend = Boolean(draft.trim() || hasQueuedFiles);

  const previewItems = useMemo(
    () =>
      pendingFiles.map((file) => ({
        file,
        url:
          file.type.startsWith("image/") || file.type.startsWith("video/")
            ? URL.createObjectURL(file)
            : null,
      })),
    [pendingFiles],
  );

  useEffect(
    () => () => {
      for (const item of previewItems) {
        if (item.url) URL.revokeObjectURL(item.url);
      }
    },
    [previewItems],
  );

  return (
    <div
      className={[styles.wrapper, rateLimitActive ? styles.blocked : ""]
        .filter(Boolean)
        .join(" ")}
    >
      {rateLimitActive && (
        <div
          className={styles.rateLimitBanner}
          role="status"
          aria-live="polite"
        >
          Слишком много сообщений. Подождите{" "}
          <span className={styles.rateLimitTimer}>{rateLimitSeconds} сек</span>
        </div>
      )}

      {uploading && (
        <div className={styles.uploadBar}>
          <div
            className={styles.uploadBarTrack}
            role="progressbar"
            aria-valuenow={uploadProgress ?? 0}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className={styles.uploadBarFill}
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          {onCancelUpload && (
            <button
              type="button"
              className={styles.uploadCancelBtn}
              onClick={onCancelUpload}
            >
              Отменить загрузку
            </button>
          )}
        </div>
      )}

      {replyTo && (
        <div className={styles.replyBar}>
          <div className={styles.replyBarAccent} />
          <div className={styles.replyBarBody}>
            <div className={styles.replyBarUser}>{replyTo.username}</div>
            <div className={styles.replyBarText}>{replyTo.content}</div>
          </div>
          <button
            type="button"
            className={styles.replyBarClose}
            onClick={onCancelReply}
            aria-label="Отменить ответ"
          >
            <IconClose />
          </button>
        </div>
      )}

      {hasQueuedFiles && (
        <div className={styles.previewWrap}>
          <div className={styles.previewHeader}>
            <span className={styles.previewTitle}>
              Вложения: {pendingFiles.length}
            </span>
            {onClearPendingFiles && !uploading && (
              <button
                type="button"
                className={styles.previewClearBtn}
                onClick={onClearPendingFiles}
              >
                Очистить
              </button>
            )}
          </div>
          <div className={styles.previewList}>
            {previewItems.map((item, index) => (
              <div
                key={`${item.file.name}-${index}`}
                className={styles.previewItem}
              >
                {item.url && item.file.type.startsWith("image/") && (
                  <img
                    className={styles.previewThumb}
                    src={item.url}
                    alt={item.file.name}
                  />
                )}
                {item.url && item.file.type.startsWith("video/") && (
                  <video
                    className={styles.previewThumb}
                    src={item.url}
                    controls
                    preload="metadata"
                    playsInline
                  />
                )}
                {!item.url && (
                  <div className={styles.previewFileBadge}>
                    {item.file.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <span className={styles.previewFileName} title={item.file.name}>
                  {item.file.name}
                </span>
                {onRemovePendingFile && !uploading && (
                  <button
                    type="button"
                    className={styles.previewRemoveBtn}
                    onClick={() => onRemovePendingFile(index)}
                    aria-label={`Удалить ${item.file.name}`}
                  >
                    <IconClose />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.inputRow}>
        {onAttach && (
          <>
            <button
              type="button"
              className={styles.attachBtn}
              onClick={() => fileInputRef.current?.click()}
              aria-label="Прикрепить файл"
              data-testid="chat-attach-button"
              disabled={disabled || uploading || rateLimitActive}
            >
              <IconAttach />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className={styles.fileInput}
              multiple
              onChange={handleFileChange}
            />
          </>
        )}

        <textarea
          className={styles.textArea}
          data-testid="chat-message-input"
          value={draft}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Сообщение..."
          aria-label="Сообщение"
          rows={1}
          disabled={disabled || rateLimitActive || uploading}
        />

        <button
          type="button"
          className={styles.sendBtn}
          data-testid="chat-send-button"
          onClick={onSend}
          disabled={!canSend || disabled || rateLimitActive || uploading}
          aria-label="Отправить сообщение"
        >
          <IconSend />
        </button>
      </div>
    </div>
  );
}
