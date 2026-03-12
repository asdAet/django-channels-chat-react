import { useCallback, useEffect, useState } from "react";

import { groupController } from "../controllers/GroupController";
import type { InvitePreview } from "../entities/group/types";
import { Spinner } from "../shared/ui";
import styles from "../styles/groups/GroupsPage.module.css";

type Props = {
  code: string;
  onNavigate: (path: string) => void;
};

export function InvitePreviewPage({ code, onNavigate }: Props) {
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    groupController
      .getInvitePreview(code)
      .then(setPreview)
      .catch((err: unknown) => {
        const msg =
          err && typeof err === "object" && "message" in err
            ? (err as { message: string }).message
            : "Приглашение не найдено";
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [code]);

  const handleJoin = useCallback(async () => {
    setJoining(true);
    setError(null);
    try {
      const result = await groupController.joinViaInvite(code);
      onNavigate(`/rooms/${result.slug}`);
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? (err as { message: string }).message
          : "Не удалось присоединиться";
      setError(msg);
    } finally {
      setJoining(false);
    }
  }, [code, onNavigate]);

  if (loading) {
    return (
      <div className={styles.inviteRoot}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (error && !preview) {
    return (
      <div className={styles.inviteRoot}>
        <div className={styles.inviteCard}>
          <div className={styles.inviteGroupName}>Ошибка</div>
          <div className={styles.inviteGroupDesc}>{error}</div>
        </div>
      </div>
    );
  }

  if (!preview) return null;

  return (
    <div className={styles.inviteRoot}>
      <div className={styles.inviteCard}>
        <div className={styles.inviteGroupName}>{preview.groupName}</div>
        {preview.groupDescription && (
          <div className={styles.inviteGroupDesc}>
            {preview.groupDescription}
          </div>
        )}
        <div className={styles.inviteMeta}>
          {preview.memberCount} участников
          {preview.isPublic ? " · Публичная" : " · Закрытая"}
        </div>
        {error && <div className={styles.dialogError}>{error}</div>}
        <button
          type="button"
          className={styles.inviteJoinBtn}
          onClick={handleJoin}
          disabled={joining}
        >
          {joining ? "Присоединяемся..." : "Присоединиться"}
        </button>
      </div>
    </div>
  );
}
