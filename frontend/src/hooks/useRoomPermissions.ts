import { useCallback, useEffect, useState } from "react";

import { apiService } from "../adapters/ApiService";
import { hasPermissionFlag } from "../entities/role/bitmask";
import type { MyPermissions } from "../entities/role/types";
import { Perm } from "../entities/role/types";

type UseRoomPermissionsResult = {
  loading: boolean;
  raw: MyPermissions | null;
  isMember: boolean;
  isBanned: boolean;
  canJoin: boolean;
  canRead: boolean;
  canWrite: boolean;
  canAttachFiles: boolean;
  canReact: boolean;
  canManageMessages: boolean;
  canManageRoles: boolean;
  canManageRoom: boolean;
  canKick: boolean;
  canBan: boolean;
  canInvite: boolean;
  canMute: boolean;
  isAdmin: boolean;
  refresh: () => Promise<void>;
};

export function useRoomPermissions(
  slug: string | null,
): UseRoomPermissionsResult {
  const [raw, setRaw] = useState<MyPermissions | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!slug) {
      setRaw(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await apiService.getMyPermissions(slug);
      setRaw(result);
    } catch {
      setRaw(null);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  const p = raw?.permissions ?? 0;
  const admin = hasPermissionFlag(p, Perm.ADMINISTRATOR);

  return {
    loading,
    raw,
    isMember: raw?.isMember ?? false,
    isBanned: raw?.isBanned ?? false,
    canJoin: raw?.canJoin ?? false,
    canRead: admin || hasPermissionFlag(p, Perm.READ_MESSAGES),
    canWrite: admin || hasPermissionFlag(p, Perm.SEND_MESSAGES),
    canAttachFiles: admin || hasPermissionFlag(p, Perm.ATTACH_FILES),
    canReact: admin || hasPermissionFlag(p, Perm.ADD_REACTIONS),
    canManageMessages: admin || hasPermissionFlag(p, Perm.MANAGE_MESSAGES),
    canManageRoles: admin || hasPermissionFlag(p, Perm.MANAGE_ROLES),
    canManageRoom:
      admin ||
      hasPermissionFlag(p, Perm.MANAGE_ROOM) ||
      hasPermissionFlag(p, Perm.CHANGE_GROUP_INFO),
    canKick: admin || hasPermissionFlag(p, Perm.KICK_MEMBERS),
    canBan: admin || hasPermissionFlag(p, Perm.BAN_MEMBERS),
    canInvite: admin || hasPermissionFlag(p, Perm.INVITE_USERS),
    canMute: admin || hasPermissionFlag(p, Perm.MUTE_MEMBERS),
    isAdmin: admin,
    refresh: load,
  };
}
