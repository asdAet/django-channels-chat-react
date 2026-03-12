import type { Friend } from "../../entities/friend/types";
import { Avatar } from "../../shared/ui";
import styles from "../../styles/friends/FriendsPage.module.css";

type Props = {
  friend: Friend;
  isOnline: boolean;
  onMessage: (username: string) => void;
  onRemove: (userId: number) => void;
  onBlock: (username: string) => void;
};

export function FriendListItem({
  friend,
  isOnline,
  onMessage,
  onRemove,
  onBlock,
}: Props) {
  return (
    <div className={styles.item}>
      <Avatar
        username={friend.username}
        profileImage={friend.profileImage}
        avatarCrop={friend.avatarCrop ?? undefined}
        size="small"
        online={isOnline}
      />
      <div className={styles.itemInfo}>
        <div className={styles.itemName}>{friend.username}</div>
        <div className={styles.itemMeta}>
          {isOnline ? "В сети" : "Не в сети"}
        </div>
      </div>
      <div className={styles.itemActions}>
        <button
          type="button"
          className={styles.actionBtn}
          onClick={() => onMessage(friend.username)}
        >
          Написать
        </button>
        <button
          type="button"
          className={[styles.actionBtn, styles.actionBtnDanger].join(" ")}
          onClick={() => onRemove(friend.userId)}
        >
          Удалить
        </button>
        <button
          type="button"
          className={[styles.actionBtn, styles.actionBtnDanger].join(" ")}
          onClick={() => onBlock(friend.username)}
        >
          Блок
        </button>
      </div>
    </div>
  );
}
