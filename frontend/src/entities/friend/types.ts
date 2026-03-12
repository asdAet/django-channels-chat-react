import type { AvatarCrop } from "../../shared/api/users";

export type Friend = {
  id: number;
  userId: number;
  username: string;
  profileImage: string | null;
  avatarCrop?: AvatarCrop | null;
  lastSeen: string | null;
};

export type FriendRequest = {
  id: number;
  userId: number;
  username: string;
  profileImage?: string | null;
  avatarCrop?: AvatarCrop | null;
  createdAt: string;
};

export type BlockedUser = {
  id: number;
  userId: number;
  username: string;
  profileImage?: string | null;
  avatarCrop?: AvatarCrop | null;
};
