import { useCallback, useEffect, useMemo, useState } from "react";

import type { UserProfile } from "../entities/user/types";
import { useFriends } from "../hooks/useFriends";
import { usePresence } from "../shared/presence";
import { Avatar, Spinner, EmptyState } from "../shared/ui";
import { AddFriendDialog } from "../widgets/friends/AddFriendDialog";
import { FriendListItem } from "../widgets/friends/FriendListItem";
import { FriendRequestItem } from "../widgets/friends/FriendRequestItem";
import styles from "../styles/friends/FriendsPage.module.css";

type Tab = "friends" | "online" | "incoming" | "outgoing" | "blocked";

type Props = {
  user: UserProfile | null;
  onNavigate: (path: string) => void;
};

const IconPlus = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

export function FriendsPage({ user, onNavigate }: Props) {
  const {
    friends,
    incoming,
    outgoing,
    blocked,
    infoMessage,
    loading,
    error,
    clearInfoMessage,
    sendRequest,
    acceptRequest,
    declineRequest,
    cancelOutgoingRequest,
    removeFriend,
    blockUser,
    unblockUser,
  } = useFriends();

  const { online: presenceOnline, status: presenceStatus } = usePresence();
  const onlineUsernames = useMemo(
    () =>
      new Set(
        presenceStatus === "online"
          ? presenceOnline.map((e) => e.username)
          : [],
      ),
    [presenceOnline, presenceStatus],
  );

  const [tab, setTab] = useState<Tab>("friends");
  const [showAddDialog, setShowAddDialog] = useState(false);

  const onlineFriends = useMemo(
    () => friends.filter((friend) => onlineUsernames.has(friend.username)),
    [friends, onlineUsernames],
  );

  useEffect(() => {
    if (!infoMessage) return;
    const timer = window.setTimeout(() => clearInfoMessage(), 3000);
    return () => window.clearTimeout(timer);
  }, [clearInfoMessage, infoMessage]);

  const handleMessage = useCallback(
    (username: string) => onNavigate(`/@${encodeURIComponent(username)}`),
    [onNavigate],
  );

  if (!user) {
    return (
      <div className={styles.root}>
        <EmptyState
          title="Авторизуйтесь"
          description="Для просмотра друзей войдите в аккаунт."
        />
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>Друзья</span>
        {incoming.length > 0 && (
          <span className={styles.headerBadge}>{incoming.length}</span>
        )}
        <button
          type="button"
          className={styles.addBtn}
          onClick={() => setShowAddDialog(true)}
          aria-label="Добавить друга"
        >
          <IconPlus />
        </button>
      </div>

      {infoMessage && <div className={styles.infoBanner}>{infoMessage}</div>}

      <div className={styles.tabs}>
        <button
          type="button"
          className={[styles.tab, tab === "friends" ? styles.tabActive : ""]
            .filter(Boolean)
            .join(" ")}
          onClick={() => setTab("friends")}
        >
          Все ({friends.length})
        </button>
        <button
          type="button"
          className={[styles.tab, tab === "online" ? styles.tabActive : ""]
            .filter(Boolean)
            .join(" ")}
          onClick={() => setTab("online")}
        >
          Онлайн ({onlineFriends.length})
        </button>
        <button
          type="button"
          className={[styles.tab, tab === "incoming" ? styles.tabActive : ""]
            .filter(Boolean)
            .join(" ")}
          onClick={() => setTab("incoming")}
        >
          Входящие ({incoming.length})
        </button>
        <button
          type="button"
          className={[styles.tab, tab === "outgoing" ? styles.tabActive : ""]
            .filter(Boolean)
            .join(" ")}
          onClick={() => setTab("outgoing")}
        >
          Исходящие ({outgoing.length})
        </button>
        <button
          type="button"
          className={[styles.tab, tab === "blocked" ? styles.tabActive : ""]
            .filter(Boolean)
            .join(" ")}
          onClick={() => setTab("blocked")}
        >
          Заблокированные ({blocked.length})
        </button>
      </div>

      <div className={styles.body}>
        {loading && (
          <div className={styles.centered}>
            <Spinner size="md" />
          </div>
        )}

        {error && <div className={styles.centered}>{error}</div>}

        {!loading &&
          !error &&
          tab === "friends" &&
          (friends.length === 0 ? (
            <EmptyState
              title="Нет друзей"
              description="Добавьте друзей, чтобы начать общение."
            />
          ) : (
            friends.map((f) => (
              <FriendListItem
                key={f.id}
                friend={f}
                isOnline={onlineUsernames.has(f.username)}
                onMessage={handleMessage}
                onRemove={removeFriend}
                onBlock={blockUser}
              />
            ))
          ))}

        {!loading &&
          !error &&
          tab === "online" &&
          (onlineFriends.length === 0 ? (
            <EmptyState
              title="Нет друзей онлайн"
              description="Когда кто-то появится в сети, он будет показан здесь."
            />
          ) : (
            onlineFriends.map((f) => (
              <FriendListItem
                key={f.id}
                friend={f}
                isOnline={true}
                onMessage={handleMessage}
                onRemove={removeFriend}
                onBlock={blockUser}
              />
            ))
          ))}

        {!loading &&
          !error &&
          tab === "incoming" &&
          (incoming.length === 0 ? (
            <EmptyState
              title="Нет входящих запросов"
              description="Новые запросы в друзья появятся здесь."
            />
          ) : (
            incoming.map((r) => (
              <FriendRequestItem
                key={r.id}
                request={r}
                direction="incoming"
                onAccept={acceptRequest}
                onDecline={declineRequest}
              />
            ))
          ))}

        {!loading &&
          !error &&
          tab === "outgoing" &&
          (outgoing.length === 0 ? (
            <EmptyState
              title="Нет исходящих запросов"
              description="Вы пока никому не отправляли запросы."
            />
          ) : (
            outgoing.map((r) => (
              <FriendRequestItem
                key={r.id}
                request={r}
                direction="outgoing"
                onCancel={cancelOutgoingRequest}
              />
            ))
          ))}

        {!loading &&
          !error &&
          tab === "blocked" &&
          (blocked.length === 0 ? (
            <EmptyState
              title="Нет заблокированных"
              description="Пользователи, которых вы заблокировали, появятся здесь."
            />
          ) : (
            blocked.map((b) => (
              <div key={b.id} className={styles.item}>
                <Avatar
                  username={b.username}
                  profileImage={b.profileImage ?? null}
                  avatarCrop={b.avatarCrop ?? undefined}
                  size="small"
                  online={false}
                />
                <div className={styles.itemInfo}>
                  <div className={styles.itemName}>{b.username}</div>
                  <div className={styles.itemMeta}>Заблокирован</div>
                </div>
                <div className={styles.itemActions}>
                  <button
                    type="button"
                    className={[styles.actionBtn, styles.actionBtnAccept].join(
                      " ",
                    )}
                    onClick={() => void unblockUser(b.userId)}
                  >
                    Разблокировать
                  </button>
                </div>
              </div>
            ))
          ))}
      </div>

      {showAddDialog && (
        <AddFriendDialog
          onSubmit={sendRequest}
          onClose={() => setShowAddDialog(false)}
        />
      )}
    </div>
  );
}
