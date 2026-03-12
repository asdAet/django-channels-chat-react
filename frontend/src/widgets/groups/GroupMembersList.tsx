import type { GroupMember } from "../../entities/group/types";
import { Avatar } from "../../shared/ui";
import styles from "../../styles/groups/GroupsPage.module.css";

type Props = {
  members: GroupMember[];
  currentUsername: string | null;
  isAdmin: boolean;
  onKick?: (userId: number) => void;
  onBan?: (userId: number) => void;
  onMute?: (userId: number) => void;
  onUnmute?: (userId: number) => void;
};

export function GroupMembersList({
  members,
  currentUsername,
  isAdmin,
  onKick,
  onBan,
  onMute,
  onUnmute,
}: Props) {
  return (
    <>
      {members.map((m) => {
        const isSelf = m.username === currentUsername;
        return (
          <div key={m.userId} className={styles.item}>
            <Avatar
              username={m.username}
              profileImage={m.profileImage ?? null}
              avatarCrop={m.avatarCrop ?? undefined}
              size="small"
              online={false}
            />
            <div className={styles.itemInfo}>
              <div className={styles.itemName}>
                {m.username}
                {m.roles.map((r) => (
                  <span key={r} className={styles.memberRoleBadge}>
                    {r}
                  </span>
                ))}
                {m.isMuted && <span className={styles.mutedTag}>muted</span>}
              </div>
              <div className={styles.itemDesc}>
                {m.nickname ||
                  `Участник с ${new Date(m.joinedAt).toLocaleDateString()}`}
              </div>
            </div>
            {isAdmin && !isSelf && (
              <div className={styles.itemActions}>
                {m.isMuted ? (
                  <button
                    type="button"
                    className={styles.actionBtn}
                    onClick={() => onUnmute?.(m.userId)}
                  >
                    Unmute
                  </button>
                ) : (
                  <button
                    type="button"
                    className={styles.actionBtn}
                    onClick={() => onMute?.(m.userId)}
                  >
                    Mute
                  </button>
                )}
                <button
                  type="button"
                  className={[styles.actionBtn, styles.actionBtnDanger].join(
                    " ",
                  )}
                  onClick={() => onKick?.(m.userId)}
                >
                  Кик
                </button>
                <button
                  type="button"
                  className={[styles.actionBtn, styles.actionBtnDanger].join(
                    " ",
                  )}
                  onClick={() => onBan?.(m.userId)}
                >
                  Бан
                </button>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
