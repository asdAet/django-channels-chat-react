import { useCallback, useState, type KeyboardEvent } from "react";

import styles from "../../styles/friends/FriendsPage.module.css";

type Props = {
  onSubmit: (username: string) => Promise<void>;
  onClose: () => void;
};

export function AddFriendDialog({ onSubmit, onClose }: Props) {
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const handleSubmit = useCallback(async () => {
    const trimmed = username.trim();
    if (!trimmed) return;

    setSending(true);
    setError(null);
    try {
      await onSubmit(trimmed);
      onClose();
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? (err as { message: string }).message
          : "Не удалось отправить запрос";
      setError(msg);
    } finally {
      setSending(false);
    }
  }, [username, onSubmit, onClose]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void handleSubmit();
      }
      if (e.key === "Escape") {
        onClose();
      }
    },
    [handleSubmit, onClose],
  );

  return (
    <div className={styles.dialog} role="dialog" aria-label="Добавить друга">
      <div className={styles.dialogBackdrop} onClick={onClose} />
      <div className={styles.dialogCard}>
        <div className={styles.dialogTitle}>Добавить друга</div>
        <input
          className={styles.dialogInput}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Имя пользователя"
          autoFocus
          disabled={sending}
        />
        {error && <div className={styles.dialogError}>{error}</div>}
        <div className={styles.dialogActions}>
          <button
            type="button"
            className={styles.dialogCancelBtn}
            onClick={onClose}
          >
            Отмена
          </button>
          <button
            type="button"
            className={styles.dialogSubmitBtn}
            onClick={handleSubmit}
            disabled={!username.trim() || sending}
          >
            Отправить
          </button>
        </div>
      </div>
    </div>
  );
}
