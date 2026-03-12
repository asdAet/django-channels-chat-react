import type { AvatarCrop } from "../../shared/api/users";

export type Group = {
  slug: string;
  name: string;
  description: string;
  isPublic: boolean;
  username: string | null;
  memberCount: number;
  slowModeSeconds: number;
  joinApprovalRequired: boolean;
  createdBy: string | null;
  avatarUrl: string | null;
  avatarCrop?: AvatarCrop | null;
};

export type GroupListItem = {
  slug: string;
  name: string;
  description: string;
  username: string | null;
  memberCount: number;
  avatarUrl?: string | null;
  avatarCrop?: AvatarCrop | null;
};

export type GroupMember = {
  userId: number;
  username: string;
  nickname: string;
  profileImage?: string | null;
  avatarCrop?: AvatarCrop | null;
  roles: string[];
  joinedAt: string;
  isMuted: boolean;
  isSelf?: boolean;
};

export type GroupInvite = {
  code: string;
  name: string;
  createdBy: string | null;
  expiresAt: string | null;
  maxUses: number;
  useCount: number;
  isRevoked: boolean;
  isExpired: boolean;
  createdAt: string;
};

export type InvitePreview = {
  code: string;
  groupSlug: string;
  groupName: string;
  groupDescription: string;
  memberCount: number;
  isPublic: boolean;
};

export type JoinRequest = {
  id: number;
  userId: number;
  username: string;
  message: string;
  createdAt: string;
};

export type PinnedMessage = {
  messageId: number;
  content: string;
  author: string | null;
  pinnedBy: string | null;
  pinnedAt: string;
  createdAt: string;
};

export type BannedMember = {
  userId: number;
  username: string;
  reason: string;
  bannedBy: string | null;
};
