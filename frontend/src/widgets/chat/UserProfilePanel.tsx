import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { friendsController } from "../../controllers/FriendsController";
import type {
  BlockedUser,
  Friend,
  FriendRequest,
} from "../../entities/friend/types";
import { useUserProfile } from "../../hooks/useUserProfile";
import { formatFullName, formatLastSeen } from "../../shared/lib/format";
import { usePresence } from "../../shared/presence";
import { Avatar, Spinner } from "../../shared/ui";
import styles from "../../styles/chat/DirectInfoPanel.module.css";

type Props = {
  username: string;
  currentUsername?: string | null;
};

type RelationState =
  | "self"
  | "none"
  | "outgoing"
  | "incoming"
  | "friend"
  | "blocked";

type RelationSnapshot = {
  state: RelationState;
  userId: number | null;
  requestId: number | null;
};

const EMPTY_RELATION: RelationSnapshot = {
  state: "none",
  userId: null,
  requestId: null,
};

const normalize = (value: string) =>
  value.trim().replace(/^@+/, "").toLowerCase();

const resolveRelation = (
  targetUsername: string,
  currentUsername: string | null | undefined,
  friends: Friend[],
  incoming: FriendRequest[],
  outgoing: FriendRequest[],
  blocked: BlockedUser[],
): RelationSnapshot => {
  const target = normalize(targetUsername);
  const current = currentUsername ? normalize(currentUsername) : null;
  if (current && current === target) {
    return { state: "self", userId: null, requestId: null };
  }

  const blockedItem = blocked.find(
    (item) => normalize(item.username) === target,
  );
  if (blockedItem) {
    return {
      state: "blocked",
      userId: blockedItem.userId,
      requestId: blockedItem.id,
    };
  }

  const incomingItem = incoming.find(
    (item) => normalize(item.username) === target,
  );
  if (incomingItem) {
    return {
      state: "incoming",
      userId: incomingItem.userId,
      requestId: incomingItem.id,
    };
  }

  const outgoingItem = outgoing.find(
    (item) => normalize(item.username) === target,
  );
  if (outgoingItem) {
    return {
      state: "outgoing",
      userId: outgoingItem.userId,
      requestId: outgoingItem.id,
    };
  }

  const friendItem = friends.find(
    (item) => normalize(item.username) === target,
  );
  if (friendItem) {
    return {
      state: "friend",
      userId: friendItem.userId,
      requestId: friendItem.id,
    };
  }

  return EMPTY_RELATION;
};

export function UserProfilePanel({ username, currentUsername }: Props) {
  const navigate = useNavigate();
  const { online: presenceOnline } = usePresence();
  const { user, loading, error } = useUserProfile(username);
  const [relation, setRelation] = useState<RelationSnapshot>(EMPTY_RELATION);
  const [relationLoading, setRelationLoading] = useState(true);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadRelationState = useCallback(async () => {
    const normalizedCurrent = currentUsername
      ? normalize(currentUsername)
      : null;
    const normalizedTarget = normalize(username);
    if (normalizedCurrent && normalizedCurrent === normalizedTarget) {
      setRelation({ state: "self", userId: null, requestId: null });
      setRelationLoading(false);
      return;
    }

    setRelationLoading(true);
    try {
      const [friends, incoming, outgoing, blocked] = await Promise.all([
        friendsController.getFriends(),
        friendsController.getIncomingRequests(),
        friendsController.getOutgoingRequests(),
        friendsController.getBlockedUsers(),
      ]);
      setRelation(
        resolveRelation(
          username,
          currentUsername,
          friends,
          incoming,
          outgoing,
          blocked,
        ),
      );
    } catch {
      setRelation(EMPTY_RELATION);
    } finally {
      setRelationLoading(false);
    }
  }, [currentUsername, username]);

  useEffect(() => {
    let active = true;
    setActionStatus(null);
    setRelationLoading(true);

    const run = async () => {
      try {
        const normalizedCurrent = currentUsername
          ? normalize(currentUsername)
          : null;
        const normalizedTarget = normalize(username);
        if (normalizedCurrent && normalizedCurrent === normalizedTarget) {
          if (active) {
            setRelation({ state: "self", userId: null, requestId: null });
          }
          return;
        }

        const [friends, incoming, outgoing, blocked] = await Promise.all([
          friendsController.getFriends(),
          friendsController.getIncomingRequests(),
          friendsController.getOutgoingRequests(),
          friendsController.getBlockedUsers(),
        ]);
        if (!active) return;
        setRelation(
          resolveRelation(
            username,
            currentUsername,
            friends,
            incoming,
            outgoing,
            blocked,
          ),
        );
      } catch {
        if (!active) return;
        setRelation(EMPTY_RELATION);
      } finally {
        if (active) {
          setRelationLoading(false);
        }
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, [currentUsername, username]);

  const runAction = useCallback(
    async (
      work: () => Promise<void>,
      successMessage: string,
      errorMessage: string,
    ) => {
      setBusy(true);
      setActionStatus(null);
      try {
        await work();
        setActionStatus(successMessage);
        await loadRelationState();
      } catch (err) {
        const message =
          err && typeof err === "object" && "message" in err
            ? String((err as { message?: string }).message || errorMessage)
            : errorMessage;
        setActionStatus(message);
      } finally {
        setBusy(false);
      }
    },
    [loadRelationState],
  );

  const handleAddFriend = useCallback(() => {
    void runAction(
      async () => {
        await friendsController.sendFriendRequest(username);
      },
      "Запрос в друзья отправлен",
      "Не удалось отправить запрос",
    );
  }, [runAction, username]);

  const handleCancelRequest = useCallback(() => {
    if (!relation.requestId) return;
    void runAction(
      async () => {
        await friendsController.cancelOutgoingFriendRequest(
          relation.requestId as number,
        );
      },
      "Запрос в друзья отменен",
      "Не удалось отменить запрос",
    );
  }, [relation.requestId, runAction]);

  const handleAcceptRequest = useCallback(() => {
    if (!relation.requestId) return;
    void runAction(
      async () => {
        await friendsController.acceptFriendRequest(
          relation.requestId as number,
        );
      },
      "Запрос принят",
      "Не удалось принять запрос",
    );
  }, [relation.requestId, runAction]);

  const handleDeclineRequest = useCallback(() => {
    if (!relation.requestId) return;
    void runAction(
      async () => {
        await friendsController.declineFriendRequest(
          relation.requestId as number,
        );
      },
      "Запрос отклонен",
      "Не удалось отклонить запрос",
    );
  }, [relation.requestId, runAction]);

  const handleRemoveFriend = useCallback(() => {
    if (!relation.userId) return;
    void runAction(
      async () => {
        await friendsController.removeFriend(relation.userId as number);
      },
      "Пользователь удален из друзей",
      "Не удалось удалить из друзей",
    );
  }, [relation.userId, runAction]);

  const handleBlock = useCallback(() => {
    void runAction(
      async () => {
        await friendsController.blockUser(username);
      },
      "Пользователь заблокирован",
      "Не удалось заблокировать пользователя",
    );
  }, [runAction, username]);

  const handleUnblock = useCallback(() => {
    if (!relation.userId) return;
    void runAction(
      async () => {
        await friendsController.unblockUser(relation.userId as number);
      },
      "Пользователь разблокирован",
      "Не удалось разблокировать пользователя",
    );
  }, [relation.userId, runAction]);

  const handleStartDirect = useCallback(() => {
    navigate(`/@${encodeURIComponent(username)}`);
  }, [navigate, username]);

  const isUserOnline = useMemo(
    () =>
      presenceOnline.some(
        (entry) => normalize(entry.username) === normalize(username),
      ),
    [presenceOnline, username],
  );

  if (loading) {
    return (
      <div className={styles.centered}>
        <Spinner size="md" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className={styles.centered}>
        <p className={styles.meta}>Пользователь не найден</p>
      </div>
    );
  }

  const fullName = formatFullName(user.name, user.last_name) || "Без имени";
  const isSelf = relation.state === "self";
  const lastSeenLabel = formatLastSeen(user.lastSeen ?? null);
  const presenceLabel = isUserOnline
    ? "В сети"
    : `Был(а) в сети: ${lastSeenLabel || "давно"}`;
  const disabled = busy || relationLoading;

  return (
    <div className={styles.root}>
      <div className={styles.profile}>
        <Avatar
          username={user.username}
          profileImage={user.profileImage}
          avatarCrop={user.avatarCrop}
          size="default"
        />
        <h4 className={styles.peerName}>{fullName}</h4>
        <p className={styles.usernameHandle}>@{user.username}</p>
        <p className={styles.meta}>{presenceLabel}</p>

        {user.bio?.trim() ? (
          <div className={styles.bioSection}>
            <span className={styles.bioLabel}>О себе</span>
            <p className={styles.bioText}>{user.bio}</p>
          </div>
        ) : null}

        {actionStatus && <p className={styles.meta}>{actionStatus}</p>}

        {!isSelf && !relationLoading && (
          <div className={styles.profileActions}>
            {relation.state === "none" && (
              <>
                <button
                  type="button"
                  className={[
                    styles.actionButton,
                    styles.actionButtonPrimary,
                  ].join(" ")}
                  onClick={handleAddFriend}
                  disabled={disabled}
                >
                  Добавить в друзья
                </button>
                <button
                  type="button"
                  className={[
                    styles.actionButton,
                    styles.actionButtonGhost,
                  ].join(" ")}
                  onClick={handleStartDirect}
                  disabled={disabled}
                >
                  Написать сообщение
                </button>
                <button
                  type="button"
                  className={[
                    styles.actionButton,
                    styles.actionButtonDanger,
                  ].join(" ")}
                  onClick={handleBlock}
                  disabled={disabled}
                >
                  Заблокировать
                </button>
              </>
            )}

            {relation.state === "outgoing" && (
              <>
                <button
                  type="button"
                  className={[
                    styles.actionButton,
                    styles.actionButtonPrimary,
                  ].join(" ")}
                  onClick={handleCancelRequest}
                  disabled={disabled}
                >
                  Отменить запрос
                </button>
                <button
                  type="button"
                  className={[
                    styles.actionButton,
                    styles.actionButtonGhost,
                  ].join(" ")}
                  onClick={handleStartDirect}
                  disabled={disabled}
                >
                  Написать сообщение
                </button>
                <button
                  type="button"
                  className={[
                    styles.actionButton,
                    styles.actionButtonDanger,
                  ].join(" ")}
                  onClick={handleBlock}
                  disabled={disabled}
                >
                  Заблокировать
                </button>
              </>
            )}

            {relation.state === "incoming" && (
              <>
                <button
                  type="button"
                  className={[
                    styles.actionButton,
                    styles.actionButtonPrimary,
                  ].join(" ")}
                  onClick={handleAcceptRequest}
                  disabled={disabled}
                >
                  Принять
                </button>
                <button
                  type="button"
                  className={[
                    styles.actionButton,
                    styles.actionButtonGhost,
                  ].join(" ")}
                  onClick={handleDeclineRequest}
                  disabled={disabled}
                >
                  Отклонить
                </button>
                <button
                  type="button"
                  className={[
                    styles.actionButton,
                    styles.actionButtonGhost,
                  ].join(" ")}
                  onClick={handleStartDirect}
                  disabled={disabled}
                >
                  Написать сообщение
                </button>
                <button
                  type="button"
                  className={[
                    styles.actionButton,
                    styles.actionButtonDanger,
                  ].join(" ")}
                  onClick={handleBlock}
                  disabled={disabled}
                >
                  Заблокировать
                </button>
              </>
            )}

            {relation.state === "friend" && (
              <>
                <button
                  type="button"
                  className={[
                    styles.actionButton,
                    styles.actionButtonGhost,
                  ].join(" ")}
                  onClick={handleRemoveFriend}
                  disabled={disabled}
                >
                  Удалить из друзей
                </button>
                <button
                  type="button"
                  className={[
                    styles.actionButton,
                    styles.actionButtonGhost,
                  ].join(" ")}
                  onClick={handleStartDirect}
                  disabled={disabled}
                >
                  Написать сообщение
                </button>
                <button
                  type="button"
                  className={[
                    styles.actionButton,
                    styles.actionButtonDanger,
                  ].join(" ")}
                  onClick={handleBlock}
                  disabled={disabled}
                >
                  Заблокировать
                </button>
              </>
            )}

            {relation.state === "blocked" && (
              <button
                type="button"
                className={[styles.actionButton, styles.actionButtonGhost].join(
                  " ",
                )}
                onClick={handleUnblock}
                disabled={disabled}
              >
                Разблокировать
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
