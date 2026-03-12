import type { AvatarCrop } from "../../shared/api/users";

export type RoomKind = "public" | "private" | "direct" | "group";

export type RoomPeer = {
  userId?: number;
  username: string;
  profileImage: string | null;
  avatarCrop?: AvatarCrop | null;
  lastSeen?: string | null;
  bio?: string | null;
  blocked?: boolean;
};

export type RoomDetails = {
  slug: string;
  name: string;
  kind: RoomKind;
  avatarUrl?: string | null;
  avatarCrop?: AvatarCrop | null;
  peer?: RoomPeer | null;
  created?: boolean;
  createdBy?: string | null;
  blocked?: boolean;
  blockedByMe?: boolean;
  lastReadMessageId?: number | null;
};

export type DirectChatListItem = {
  slug: string;
  peer: RoomPeer;
  lastMessage: string;
  lastMessageAt: string;
};
