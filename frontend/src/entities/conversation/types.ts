import type { AvatarCrop } from "../../shared/api/users";

export type ConversationType = "direct" | "group" | "room";

export type ConversationItem = {
  type: ConversationType;
  slug: string;
  name: string;
  avatarUrl: string | null;
  avatarCrop: AvatarCrop | null;
  lastMessage: string;
  lastMessageAt: string | null;
  unreadCount: number;
  isOnline?: boolean;
  isMuted?: boolean;
  isPinned?: boolean;
};
