import type { Attachment, Message } from "../../entities/message/types";
import type {
  BlockedUser,
  Friend,
  FriendRequest,
} from "../../entities/friend/types";
import type { SendFriendRequestResponse } from "../../dto/http/friends";
import type {
  Group,
  GroupListItem,
  GroupMember,
  GroupInvite,
  InvitePreview,
  JoinRequest,
  PinnedMessage,
  BannedMember,
} from "../../entities/group/types";
import type {
  Role,
  MemberRoles,
  PermissionOverride,
  MyPermissions,
} from "../../entities/role/types";
import type {
  DirectChatListItem,
  RoomDetails,
  RoomKind,
  RoomPeer,
} from "../../entities/room/types";
import type { UserProfile } from "../../entities/user/types";
import type { AvatarCrop } from "../../shared/api/users";

export type UpdateProfileInput = {
  name?: string;
  username?: string;
  image?: File | null;
  avatarCrop?: AvatarCrop | null;
  bio?: string;
};

export type SessionResponse = {
  authenticated: boolean;
  user: UserProfile | null;
};

export type UpdateGroupInput = Partial<{
  name: string;
  description: string;
  isPublic: boolean;
  username: string | null;
  slowModeSeconds: number;
  joinApprovalRequired: boolean;
}> & {
  avatar?: File | null;
  avatarCrop?: AvatarCrop | null;
  avatarAction?: "remove";
};

export type RoomMessagesResponse = {
  messages: Message[];
  pagination?: {
    limit: number;
    hasMore: boolean;
    nextBefore: number | null;
  };
};

export type DirectStartResponse = {
  roomId: number;
  kind: RoomKind;
  peer: RoomPeer;
};

export type DirectChatsResponse = {
  items: DirectChatListItem[];
};

export type ClientRuntimeConfig = {
  usernameMaxLength: number;
  chatMessageMaxLength: number;
  chatRoomSlugRegex: string;
  chatAttachmentMaxSizeMb: number;
  chatAttachmentMaxPerMessage: number;
  chatAttachmentAllowedTypes: string[];
  mediaUrlTtlSeconds: number;
  mediaMode: "signed_only";
  googleOAuthClientId: string;
};

/**
 * Контракт API-слоя, который возвращает только доменные типы.
 */
export interface IApiService {
  ensureCsrf(): Promise<{ csrfToken: string }>;

  ensurePresenceSession(): Promise<{ ok: boolean }>;

  getClientConfig(): Promise<ClientRuntimeConfig>;

  getSession(): Promise<SessionResponse>;

  login(identifier: string, password: string): Promise<SessionResponse>;

  oauthGoogle(
    token: string,
    tokenType?: "idToken" | "accessToken",
    username?: string,
  ): Promise<SessionResponse>;

  register(
    login: string,
    password: string,
    passwordConfirm: string,
    name: string,
    username?: string,
    email?: string,
  ): Promise<SessionResponse>;

  getPasswordRules(): Promise<{ rules: string[] }>;

  logout(): Promise<{ ok: boolean }>;

  updateProfile(fields: UpdateProfileInput): Promise<{ user: UserProfile }>;

  getPublicRoom(): Promise<RoomDetails>;

  getRoomDetails(slug: string): Promise<RoomDetails>;

  getRoomMessages(
    slug: string,
    params?: { limit?: number; beforeId?: number },
  ): Promise<RoomMessagesResponse>;

  startDirectChat(publicRef: string): Promise<DirectStartResponse>;

  getDirectChats(): Promise<DirectChatsResponse>;

  getUserProfile(publicRef: string): Promise<{ user: UserProfile }>;

  // --- Phase 2+3: Messages & Rooms ---
  getUnreadCounts(): Promise<UnreadCountItem[]>;

  editMessage(
    slug: string,
    messageId: number,
    content: string,
  ): Promise<EditMessageResult>;

  deleteMessage(slug: string, messageId: number): Promise<void>;

  addReaction(
    slug: string,
    messageId: number,
    emoji: string,
  ): Promise<ReactionResult>;

  removeReaction(slug: string, messageId: number, emoji: string): Promise<void>;

  searchMessages(slug: string, query: string): Promise<SearchResult>;

  uploadAttachments(
    slug: string,
    files: File[],
    options?: UploadAttachmentsOptions,
  ): Promise<UploadResult>;

  markRead(slug: string, messageId?: number): Promise<ReadStateResult>;

  // --- Phase 4: Friends ---
  getFriends(): Promise<Friend[]>;
  sendFriendRequest(username: string): Promise<SendFriendRequestResponse>;
  getIncomingRequests(): Promise<FriendRequest[]>;
  getOutgoingRequests(): Promise<FriendRequest[]>;
  acceptFriendRequest(friendshipId: number): Promise<void>;
  declineFriendRequest(friendshipId: number): Promise<void>;
  cancelOutgoingFriendRequest(friendshipId: number): Promise<void>;
  removeFriend(userId: number): Promise<void>;
  blockUser(username: string): Promise<void>;
  unblockUser(userId: number): Promise<void>;
  getBlockedUsers(): Promise<BlockedUser[]>;

  // --- Phase 5: Groups ---
  createGroup(data: {
    name: string;
    description?: string;
    isPublic?: boolean;
    username?: string | null;
  }): Promise<Group>;
  getPublicGroups(params?: {
    search?: string;
    limit?: number;
    before?: number;
  }): Promise<{
    items: GroupListItem[];
    total: number;
    pagination: {
      limit: number;
      hasMore: boolean;
      nextBefore: number | null;
    };
  }>;
  getMyGroups(params?: {
    search?: string;
    limit?: number;
    before?: number;
  }): Promise<{
    items: GroupListItem[];
    total: number;
    pagination: {
      limit: number;
      hasMore: boolean;
      nextBefore: number | null;
    };
  }>;
  getGroupDetails(slug: string): Promise<Group>;
  updateGroup(slug: string, data: UpdateGroupInput): Promise<Group>;
  deleteGroup(slug: string): Promise<void>;
  joinGroup(slug: string): Promise<void>;
  leaveGroup(slug: string): Promise<void>;
  getGroupMembers(
    slug: string,
    params?: { limit?: number; before?: number },
  ): Promise<{
    items: GroupMember[];
    total: number;
    pagination: {
      limit: number;
      hasMore: boolean;
      nextBefore: number | null;
    };
  }>;
  kickMember(slug: string, userId: number): Promise<void>;
  banMember(slug: string, userId: number, reason?: string): Promise<void>;
  unbanMember(slug: string, userId: number): Promise<void>;
  muteMember(
    slug: string,
    userId: number,
    durationSeconds?: number,
  ): Promise<void>;
  unmuteMember(slug: string, userId: number): Promise<void>;
  getBannedMembers(
    slug: string,
    params?: { limit?: number; before?: number },
  ): Promise<{
    items: BannedMember[];
    total: number;
    pagination: {
      limit: number;
      hasMore: boolean;
      nextBefore: number | null;
    };
  }>;
  createInvite(
    slug: string,
    data?: { maxUses?: number; expiresInHours?: number },
  ): Promise<GroupInvite>;
  getInvites(slug: string): Promise<GroupInvite[]>;
  revokeInvite(slug: string, code: string): Promise<void>;
  getInvitePreview(code: string): Promise<InvitePreview>;
  joinViaInvite(code: string): Promise<{ roomId: number }>;
  getJoinRequests(slug: string): Promise<JoinRequest[]>;
  approveJoinRequest(slug: string, requestId: number): Promise<void>;
  rejectJoinRequest(slug: string, requestId: number): Promise<void>;
  getPinnedMessages(slug: string): Promise<PinnedMessage[]>;
  pinMessage(slug: string, messageId: number): Promise<void>;
  unpinMessage(slug: string, messageId: number): Promise<void>;
  transferOwnership(slug: string, userId: number): Promise<void>;

  // --- Phase 6: Roles & Permissions ---
  getRoomRoles(slug: string): Promise<Role[]>;
  createRoomRole(
    slug: string,
    data: { name: string; color?: string; permissions?: number },
  ): Promise<Role>;
  updateRoomRole(
    slug: string,
    roleId: number,
    data: Partial<{
      name: string;
      color: string;
      permissions: number;
      position: number;
    }>,
  ): Promise<Role>;
  deleteRoomRole(slug: string, roleId: number): Promise<void>;
  getMemberRoles(slug: string, userId: number): Promise<MemberRoles>;
  setMemberRoles(
    slug: string,
    userId: number,
    roleIds: number[],
  ): Promise<MemberRoles>;
  getRoomOverrides(slug: string): Promise<PermissionOverride[]>;
  createRoomOverride(
    slug: string,
    data: {
      targetRoleId?: number;
      targetUserId?: number;
      allow?: number;
      deny?: number;
    },
  ): Promise<PermissionOverride>;
  updateRoomOverride(
    slug: string,
    overrideId: number,
    data: Partial<{ allow: number; deny: number }>,
  ): Promise<PermissionOverride>;
  deleteRoomOverride(slug: string, overrideId: number): Promise<void>;
  getMyPermissions(slug: string): Promise<MyPermissions>;

  globalSearch(
    query: string,
    params?: {
      usersLimit?: number;
      groupsLimit?: number;
      messagesLimit?: number;
    },
  ): Promise<GlobalSearchResult>;

  getRoomAttachments(
    slug: string,
    params?: { limit?: number; before?: number },
  ): Promise<RoomAttachmentsResult>;
}

export type EditMessageResult = {
  id: number;
  content: string;
  editedAt: string;
};
export type ReactionResult = {
  messageId: number;
  emoji: string;
  userId: number;
  username: string;
};
export type SearchResultItem = {
  id: number;
  username: string;
  displayName?: string;
  content: string;
  createdAt: string;
  highlight: string | null;
};
export type SearchResult = {
  results: SearchResultItem[];
  pagination?: { limit: number; hasMore: boolean; nextBefore: number | null };
};
export type UploadResult = {
  id: number;
  content: string;
  attachments: Attachment[];
};
export type ReadStateResult = {
  roomId: number;
  lastReadMessageId: number | null;
};
export type UnreadCountItem = { roomId: number; unreadCount: number };

export type UploadAttachmentsOptions = {
  onProgress?: (percent: number) => void;
  messageContent?: string;
  replyTo?: number | null;
  signal?: AbortSignal;
};

export type RoomAttachmentItem = Attachment & {
  messageId: number;
  createdAt: string;
  username: string;
  displayName?: string;
};

export type RoomAttachmentsResult = {
  items: RoomAttachmentItem[];
  pagination: {
    limit: number;
    hasMore: boolean;
    nextBefore: number | null;
  };
};

export type GlobalSearchUser = {
  username: string;
  displayName?: string;
  profileImage: string | null;
  avatarCrop: AvatarCrop | null;
  lastSeen: string | null;
};

export type GlobalSearchGroup = {
  roomId: number;
  name: string;
  description: string;
  publicRef: string;
  memberCount: number;
  isPublic: boolean;
};

export type GlobalSearchMessage = {
  id: number;
  username: string;
  displayName?: string;
  content: string;
  createdAt: string;
  roomId: number;
  roomName: string;
  roomKind: RoomKind;
};

export type GlobalSearchResult = {
  users: GlobalSearchUser[];
  groups: GlobalSearchGroup[];
  messages: GlobalSearchMessage[];
};
