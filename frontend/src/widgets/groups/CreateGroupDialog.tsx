import { useCallback, useState, type KeyboardEvent } from "react";

import { groupController } from "../../controllers/GroupController";
import styles from "../../styles/groups/GroupsPage.module.css";

type Props = {
  onCreated: (slug: string) => void;
  onClose: () => void;
};

export function CreateGroupDialog({ onCreated, onClose }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const handleSubmit = useCallback(async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    setSending(true);
    setError(null);
    try {
      const group = await groupController.createGroup({
        name: trimmedName,
        description: description.trim() || undefined,
        isPublic,
      });
      onCreated(group.slug);
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? (err as { message: string }).message
          : "Не удалось создать группу";
      setError(msg);
    } finally {
      setSending(false);
    }
  }, [description, isPublic, name, onCreated]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  return (
    <div
      className={styles.dialog}
      role="dialog"
      aria-label="Создать группу"
      onKeyDown={handleKeyDown}
    >
      <div className={styles.dialogBackdrop} onClick={onClose} />
      <div className={styles.dialogCard}>
        <div className={styles.dialogTitle}>Новая группа</div>

        <div className={styles.dialogField}>
          <label className={styles.dialogLabel}>Название</label>
          <input
            className={styles.dialogInput}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Название группы"
            autoFocus
            disabled={sending}
          />
        </div>

        <div className={styles.dialogField}>
          <label className={styles.dialogLabel}>Описание</label>
          <textarea
            className={styles.dialogTextarea}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="О чем эта группа? (необязательно)"
            disabled={sending}
          />
        </div>

        <label className={styles.dialogCheckRow}>
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            disabled={sending}
          />
          Публичная группа
        </label>

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
            disabled={!name.trim() || sending}
          >
            Создать
          </button>
        </div>
      </div>
    </div>
  );
}
