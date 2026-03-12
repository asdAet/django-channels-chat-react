export type Role = {
  id: number;
  name: string;
  color: string;
  position: number;
  permissions: number;
  isDefault: boolean;
  createdAt: string;
};

export type MemberRoles = {
  userId: number;
  username: string;
  roleIds: number[];
  roles: string[];
  isBanned: boolean;
  joinedAt: string;
};

export type PermissionOverride = {
  id: number;
  targetRoleId: number | null;
  targetUserId: number | null;
  allow: number;
  deny: number;
};

export type MyPermissions = {
  permissions: number;
  roles?: number[];
  isMember?: boolean;
  isBanned?: boolean;
  canJoin?: boolean;
};

/** Bitmask flags matching backend roles/permissions.py Perm enum. */
export const Perm = {
  SEND_MESSAGES: 2 ** 0,
  READ_MESSAGES: 2 ** 1,
  ATTACH_FILES: 2 ** 2,
  EMBED_LINKS: 2 ** 3,
  MENTION_EVERYONE: 2 ** 4,
  ADD_REACTIONS: 2 ** 5,
  MANAGE_MESSAGES: 2 ** 8,
  KICK_MEMBERS: 2 ** 9,
  BAN_MEMBERS: 2 ** 10,
  MUTE_MEMBERS: 2 ** 11,
  PIN_MESSAGES: 2 ** 12,
  INVITE_USERS: 2 ** 13,
  CHANGE_GROUP_INFO: 2 ** 14,
  MANAGE_ROLES: 2 ** 16,
  MANAGE_ROOM: 2 ** 17,
  MANAGE_INVITES: 2 ** 18,
  VIEW_AUDIT_LOG: 2 ** 19,
  VOICE_CONNECT: 2 ** 24,
  VOICE_SPEAK: 2 ** 25,
  VOICE_MUTE_OTHERS: 2 ** 26,
  VOICE_DEAFEN_OTHERS: 2 ** 27,
  ADMINISTRATOR: 2 ** 32,
} as const;
