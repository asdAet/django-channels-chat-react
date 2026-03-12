import { z } from "zod";

import type {
  BlockedUser,
  Friend,
  FriendRequest,
} from "../../entities/friend/types";
import { decodeOrThrow } from "../core/codec";

// Backend returns: { id, user: { id, username }, created_at }
const avatarCropSchema = z
  .object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  })
  .passthrough();

const userBriefSchema = z
  .object({
    id: z.number(),
    username: z.string(),
    profileImage: z.string().nullable().optional(),
    avatarCrop: avatarCropSchema.nullable().optional(),
  })
  .passthrough();

const friendshipSchema = z
  .object({
    id: z.number(),
    user: userBriefSchema,
    created_at: z.string(),
  })
  .passthrough();

const friendListSchema = z
  .object({ items: z.array(friendshipSchema) })
  .passthrough();
const requestListSchema = z
  .object({ items: z.array(friendshipSchema) })
  .passthrough();

const mapFriend = (dto: z.infer<typeof friendshipSchema>): Friend => ({
  id: dto.id,
  userId: dto.user.id,
  username: dto.user.username,
  profileImage: dto.user.profileImage ?? null,
  avatarCrop: dto.user.avatarCrop ?? null,
  lastSeen: null,
});

const mapIncomingRequest = (
  dto: z.infer<typeof friendshipSchema>,
): FriendRequest => ({
  id: dto.id,
  userId: dto.user.id,
  username: dto.user.username,
  profileImage: dto.user.profileImage ?? null,
  avatarCrop: dto.user.avatarCrop ?? null,
  createdAt: dto.created_at,
});

const mapOutgoingRequest = (
  dto: z.infer<typeof friendshipSchema>,
): FriendRequest => ({
  id: dto.id,
  userId: dto.user.id,
  username: dto.user.username,
  profileImage: dto.user.profileImage ?? null,
  avatarCrop: dto.user.avatarCrop ?? null,
  createdAt: dto.created_at,
});

export const decodeFriendsListResponse = (input: unknown): Friend[] => {
  const parsed = decodeOrThrow(friendListSchema, input, "friends/list");
  return parsed.items.map(mapFriend);
};

export const decodeIncomingRequestsResponse = (
  input: unknown,
): FriendRequest[] => {
  const parsed = decodeOrThrow(requestListSchema, input, "friends/incoming");
  return parsed.items.map(mapIncomingRequest);
};

export const decodeOutgoingRequestsResponse = (
  input: unknown,
): FriendRequest[] => {
  const parsed = decodeOrThrow(requestListSchema, input, "friends/outgoing");
  return parsed.items.map(mapOutgoingRequest);
};

const sendRequestResponseSchema = z
  .object({
    item: z
      .object({
        id: z.number(),
        user: userBriefSchema.optional(),
        created_at: z.string().optional(),
      })
      .passthrough(),
  })
  .passthrough();

export type SendFriendRequestResponse = {
  id: number;
  status: string;
};

export const decodeSendFriendRequestResponse = (
  input: unknown,
): SendFriendRequestResponse => {
  const parsed = decodeOrThrow(
    sendRequestResponseSchema,
    input,
    "friends/send-request",
  );
  return { id: parsed.item.id, status: "pending" };
};

const blockResponseSchema = z
  .object({
    item: z.object({ id: z.number(), status: z.string() }).passthrough(),
  })
  .passthrough();

export const decodeBlockResponse = (input: unknown): BlockedUser => {
  const parsed = decodeOrThrow(blockResponseSchema, input, "friends/block");
  return { id: parsed.item.id, userId: 0, username: "" };
};

const blockedListSchema = z
  .object({ items: z.array(friendshipSchema) })
  .passthrough();

const mapBlockedUser = (
  dto: z.infer<typeof friendshipSchema>,
): BlockedUser => ({
  id: dto.id,
  userId: dto.user.id,
  username: dto.user.username,
  profileImage: dto.user.profileImage ?? null,
  avatarCrop: dto.user.avatarCrop ?? null,
});

export const decodeBlockedListResponse = (input: unknown): BlockedUser[] => {
  const parsed = decodeOrThrow(blockedListSchema, input, "friends/blocked");
  return parsed.items.map(mapBlockedUser);
};
