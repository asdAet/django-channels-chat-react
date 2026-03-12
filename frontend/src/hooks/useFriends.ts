import { useCallback, useEffect, useState } from "react";

import { friendsController } from "../controllers/FriendsController";
import type {
  BlockedUser,
  Friend,
  FriendRequest,
} from "../entities/friend/types";

type UseFriendsResult = {
  friends: Friend[];
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
  blocked: BlockedUser[];
  infoMessage: string | null;
  loading: boolean;
  error: string | null;
  clearInfoMessage: () => void;
  reload: () => void;
  sendRequest: (username: string) => Promise<void>;
  acceptRequest: (id: number) => Promise<void>;
  declineRequest: (id: number) => Promise<void>;
  cancelOutgoingRequest: (id: number) => Promise<void>;
  removeFriend: (userId: number) => Promise<void>;
  blockUser: (username: string) => Promise<void>;
  unblockUser: (userId: number) => Promise<void>;
};

export function useFriends(): UseFriendsResult {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<FriendRequest[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequest[]>([]);
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [f, inc, out, bl] = await Promise.all([
        friendsController.getFriends(),
        friendsController.getIncomingRequests(),
        friendsController.getOutgoingRequests(),
        friendsController.getBlockedUsers(),
      ]);
      setFriends(f);
      setIncoming(inc);
      setOutgoing(out);
      setBlocked(bl);
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? (err as { message: string }).message
          : "Ошибка загрузки";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const sendRequest = useCallback(
    async (username: string) => {
      setInfoMessage(null);
      try {
        await friendsController.sendFriendRequest(username);
        setInfoMessage("Запрос отправлен");
      } catch (err: unknown) {
        const status =
          err && typeof err === "object" && "status" in err
            ? Number((err as { status?: number }).status)
            : 0;
        if (status === 409) {
          const msg =
            err && typeof err === "object" && "message" in err
              ? String((err as { message?: string }).message)
              : "Запрос уже существует или пользователь уже в друзьях";
          setInfoMessage(msg);
          await reload();
          return;
        }
        throw err;
      }
      void reload();
    },
    [reload],
  );

  const acceptRequest = useCallback(
    async (id: number) => {
      await friendsController.acceptFriendRequest(id);
      void reload();
    },
    [reload],
  );

  const declineRequest = useCallback(
    async (id: number) => {
      await friendsController.declineFriendRequest(id);
      void reload();
    },
    [reload],
  );

  const cancelOutgoingRequest = useCallback(
    async (id: number) => {
      await friendsController.cancelOutgoingFriendRequest(id);
      void reload();
    },
    [reload],
  );

  const removeFriendCb = useCallback(
    async (userId: number) => {
      await friendsController.removeFriend(userId);
      void reload();
    },
    [reload],
  );

  const blockUserCb = useCallback(
    async (username: string) => {
      await friendsController.blockUser(username);
      void reload();
    },
    [reload],
  );

  const unblockUserCb = useCallback(
    async (userId: number) => {
      await friendsController.unblockUser(userId);
      void reload();
    },
    [reload],
  );

  return {
    friends,
    incoming,
    outgoing,
    blocked,
    infoMessage,
    loading,
    error,
    clearInfoMessage: () => setInfoMessage(null),
    reload,
    sendRequest,
    acceptRequest,
    declineRequest,
    cancelOutgoingRequest,
    removeFriend: removeFriendCb,
    blockUser: blockUserCb,
    unblockUser: unblockUserCb,
  };
}
