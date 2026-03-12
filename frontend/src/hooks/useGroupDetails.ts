import { useCallback, useEffect, useState } from "react";

import { groupController } from "../controllers/GroupController";
import type { UpdateGroupInput } from "../domain/interfaces/IApiService";
import type {
  Group,
  GroupMember,
  PinnedMessage,
} from "../entities/group/types";

type UseGroupDetailsResult = {
  group: Group | null;
  members: GroupMember[];
  pins: PinnedMessage[];
  loading: boolean;
  error: string | null;
  reload: () => void;
  updateGroup: (data: UpdateGroupInput) => Promise<void>;
  deleteGroup: () => Promise<void>;
  joinGroup: () => Promise<void>;
  leaveGroup: () => Promise<void>;
  kickMember: (userId: number) => Promise<void>;
  banMember: (userId: number, reason?: string) => Promise<void>;
  muteMember: (userId: number, durationSeconds?: number) => Promise<void>;
  unmuteMember: (userId: number) => Promise<void>;
  pinMessage: (messageId: number) => Promise<void>;
  unpinMessage: (messageId: number) => Promise<void>;
};

export function useGroupDetails(slug: string): UseGroupDetailsResult {
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [pins, setPins] = useState<PinnedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [g, m, p] = await Promise.all([
        groupController.getGroupDetails(slug),
        groupController.getGroupMembers(slug),
        groupController.getPinnedMessages(slug),
      ]);
      setGroup(g);
      setMembers(m.items);
      setPins(p);
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? (err as { message: string }).message
          : "Ошибка загрузки";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const updateGroupCb = useCallback(
    async (data: UpdateGroupInput) => {
      const updated = await groupController.updateGroup(slug, data);
      setGroup(updated);
    },
    [slug],
  );

  const deleteGroupCb = useCallback(async () => {
    await groupController.deleteGroup(slug);
  }, [slug]);

  const joinGroupCb = useCallback(async () => {
    await groupController.joinGroup(slug);
    void reload();
  }, [slug, reload]);

  const leaveGroupCb = useCallback(async () => {
    await groupController.leaveGroup(slug);
    void reload();
  }, [slug, reload]);

  const kickMemberCb = useCallback(
    async (userId: number) => {
      await groupController.kickMember(slug, userId);
      void reload();
    },
    [slug, reload],
  );

  const banMemberCb = useCallback(
    async (userId: number, reason?: string) => {
      await groupController.banMember(slug, userId, reason);
      void reload();
    },
    [slug, reload],
  );

  const muteMemberCb = useCallback(
    async (userId: number, durationSeconds?: number) => {
      await groupController.muteMember(slug, userId, durationSeconds);
      void reload();
    },
    [slug, reload],
  );

  const unmuteMemberCb = useCallback(
    async (userId: number) => {
      await groupController.unmuteMember(slug, userId);
      void reload();
    },
    [slug, reload],
  );

  const pinMessageCb = useCallback(
    async (messageId: number) => {
      await groupController.pinMessage(slug, messageId);
      const updated = await groupController.getPinnedMessages(slug);
      setPins(updated);
    },
    [slug],
  );

  const unpinMessageCb = useCallback(
    async (messageId: number) => {
      await groupController.unpinMessage(slug, messageId);
      const updated = await groupController.getPinnedMessages(slug);
      setPins(updated);
    },
    [slug],
  );

  return {
    group,
    members,
    pins,
    loading,
    error,
    reload,
    updateGroup: updateGroupCb,
    deleteGroup: deleteGroupCb,
    joinGroup: joinGroupCb,
    leaveGroup: leaveGroupCb,
    kickMember: kickMemberCb,
    banMember: banMemberCb,
    muteMember: muteMemberCb,
    unmuteMember: unmuteMemberCb,
    pinMessage: pinMessageCb,
    unpinMessage: unpinMessageCb,
  };
}
