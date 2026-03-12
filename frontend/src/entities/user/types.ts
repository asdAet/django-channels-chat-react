import type { AvatarCrop } from "../../shared/api/users";

export type UserProfile = {
  name?: string;
  last_name?: string;
  username: string;
  email: string;
  profileImage: string | null;
  avatarCrop?: AvatarCrop | null;
  bio: string;
  lastSeen: string | null;
  registeredAt: string | null;
};
