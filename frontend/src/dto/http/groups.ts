import { z } from "zod";

import type {
  BannedMember,
  Group,
  GroupInvite,
  GroupListItem,
  GroupMember,
  InvitePreview,
  JoinRequest,
  PinnedMessage,
} from "../../entities/group/types";
import { decodeOrThrow } from "../core/codec";

const avatarCropSchema = z
  .object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  })
  .passthrough();

const groupSchema = z
  .object({
    slug: z.string(),
    name: z.string(),
    description: z.string().optional(),
    isPublic: z.boolean().optional(),
    username: z.string().nullable().optional(),
    memberCount: z.number().optional(),
    slowModeSeconds: z.number().optional(),
    joinApprovalRequired: z.boolean().optional(),
    createdBy: z.string().nullable().optional(),
    avatarUrl: z.string().nullable().optional(),
    avatarCrop: avatarCropSchema.nullable().optional(),
  })
  .passthrough();

const groupListItemSchema = z
  .object({
    slug: z.string(),
    name: z.string(),
    description: z.string().optional(),
    username: z.string().nullable().optional(),
    memberCount: z.number().optional(),
    avatarUrl: z.string().nullable().optional(),
    avatarCrop: avatarCropSchema.nullable().optional(),
  })
  .passthrough();

const groupListSchema = z
  .object({
    items: z.array(groupListItemSchema),
    page: z.number().optional(),
    pageSize: z.number().optional(),
    total: z.number().optional(),
  })
  .passthrough();

const memberSchema = z
  .object({
    userId: z.number(),
    username: z.string(),
    nickname: z.string().nullable().optional(),
    roles: z
      .array(
        z.union([
          z.string(),
          z
            .object({
              id: z.number().optional(),
              name: z.string().optional(),
              color: z.string().optional(),
            })
            .passthrough(),
        ]),
      )
      .optional(),
    profileImage: z.string().nullable().optional(),
    avatarCrop: avatarCropSchema.nullable().optional(),
    joinedAt: z.string(),
    isMuted: z.boolean().optional(),
    isSelf: z.boolean().optional(),
  })
  .passthrough();

const memberListSchema = z
  .object({
    items: z.array(memberSchema),
    page: z.number().optional(),
    pageSize: z.number().optional(),
    total: z.number().optional(),
  })
  .passthrough();

const inviteSchema = z
  .object({
    code: z.string(),
    name: z.string().optional(),
    createdBy: z.string().nullable().optional(),
    expiresAt: z.string().nullable().optional(),
    maxUses: z.number().optional(),
    useCount: z.number().optional(),
    isRevoked: z.boolean().optional(),
    isExpired: z.boolean().optional(),
    createdAt: z.string(),
  })
  .passthrough();

const inviteListSchema = z
  .object({ items: z.array(inviteSchema) })
  .passthrough();

const invitePreviewSchema = z
  .object({
    code: z.string(),
    groupSlug: z.string(),
    groupName: z.string(),
    groupDescription: z.string().optional(),
    memberCount: z.number().optional(),
    isPublic: z.boolean().optional(),
  })
  .passthrough();

const joinRequestSchema = z
  .object({
    id: z.number(),
    userId: z.number(),
    username: z.string(),
    message: z.string().optional(),
    createdAt: z.string(),
  })
  .passthrough();

const joinRequestListSchema = z
  .object({ items: z.array(joinRequestSchema) })
  .passthrough();

const pinSchema = z
  .object({
    messageId: z.number(),
    content: z.string().optional(),
    author: z.string().nullable().optional(),
    pinnedBy: z.string().nullable().optional(),
    pinnedAt: z.string(),
    createdAt: z.string().optional(),
  })
  .passthrough();

const pinListSchema = z.object({ items: z.array(pinSchema) }).passthrough();

const bannedSchema = z
  .object({
    userId: z.number(),
    username: z.string(),
    reason: z.string().optional(),
    bannedBy: z.string().nullable().optional(),
  })
  .passthrough();

const bannedListSchema = z
  .object({
    items: z.array(bannedSchema),
    page: z.number().optional(),
    pageSize: z.number().optional(),
    total: z.number().optional(),
  })
  .passthrough();

const mapGroup = (dto: z.infer<typeof groupSchema>): Group => ({
  slug: dto.slug,
  name: dto.name,
  description: dto.description ?? "",
  isPublic: dto.isPublic ?? false,
  username: dto.username ?? null,
  memberCount: dto.memberCount ?? 0,
  slowModeSeconds: dto.slowModeSeconds ?? 0,
  joinApprovalRequired: dto.joinApprovalRequired ?? false,
  createdBy: dto.createdBy ?? null,
  avatarUrl: dto.avatarUrl ?? null,
  avatarCrop: dto.avatarCrop ?? null,
});

export const decodeGroupResponse = (input: unknown): Group =>
  mapGroup(decodeOrThrow(groupSchema, input, "groups/detail"));

export const decodeGroupListResponse = (
  input: unknown,
): {
  items: GroupListItem[];
  total: number;
  page: number;
  pageSize: number;
} => {
  const parsed = decodeOrThrow(groupListSchema, input, "groups/list");
  return {
    items: parsed.items.map((i) => ({
      slug: i.slug,
      name: i.name,
      description: i.description ?? "",
      username: i.username ?? null,
      memberCount: i.memberCount ?? 0,
      avatarUrl: i.avatarUrl ?? null,
      avatarCrop: i.avatarCrop ?? null,
    })),
    total: parsed.total ?? parsed.items.length,
    page: parsed.page ?? 1,
    pageSize: parsed.pageSize ?? parsed.items.length,
  };
};

export const decodeGroupMembersResponse = (
  input: unknown,
): { items: GroupMember[]; total: number } => {
  const parsed = decodeOrThrow(memberListSchema, input, "groups/members");
  return {
    items: parsed.items.map((m) => ({
      userId: m.userId,
      username: m.username,
      nickname: m.nickname ?? "",
      profileImage: m.profileImage ?? null,
      avatarCrop: m.avatarCrop ?? null,
      roles: (m.roles ?? []).map((role) =>
        typeof role === "string"
          ? role
          : role.name || (role.id ? `role_${role.id}` : "role"),
      ),
      joinedAt: m.joinedAt,
      isMuted: m.isMuted ?? false,
      isSelf: m.isSelf ?? false,
    })),
    total: parsed.total ?? parsed.items.length,
  };
};

export const decodeInvitesResponse = (input: unknown): GroupInvite[] => {
  const parsed = decodeOrThrow(inviteListSchema, input, "groups/invites");
  return parsed.items.map((i) => ({
    code: i.code,
    name: i.name ?? "",
    createdBy: i.createdBy ?? null,
    expiresAt: i.expiresAt ?? null,
    maxUses: i.maxUses ?? 0,
    useCount: i.useCount ?? 0,
    isRevoked: i.isRevoked ?? false,
    isExpired: i.isExpired ?? false,
    createdAt: i.createdAt,
  }));
};

export const decodeInviteResponse = (input: unknown): GroupInvite => {
  const parsed = decodeOrThrow(inviteSchema, input, "groups/invite");
  return {
    code: parsed.code,
    name: parsed.name ?? "",
    createdBy: parsed.createdBy ?? null,
    expiresAt: parsed.expiresAt ?? null,
    maxUses: parsed.maxUses ?? 0,
    useCount: parsed.useCount ?? 0,
    isRevoked: parsed.isRevoked ?? false,
    isExpired: parsed.isExpired ?? false,
    createdAt: parsed.createdAt,
  };
};

export const decodeInvitePreviewResponse = (input: unknown): InvitePreview => {
  const parsed = decodeOrThrow(
    invitePreviewSchema,
    input,
    "groups/invite-preview",
  );
  return {
    code: parsed.code,
    groupSlug: parsed.groupSlug,
    groupName: parsed.groupName,
    groupDescription: parsed.groupDescription ?? "",
    memberCount: parsed.memberCount ?? 0,
    isPublic: parsed.isPublic ?? false,
  };
};

export const decodeJoinRequestsResponse = (input: unknown): JoinRequest[] => {
  const parsed = decodeOrThrow(
    joinRequestListSchema,
    input,
    "groups/join-requests",
  );
  return parsed.items.map((r) => ({
    id: r.id,
    userId: r.userId,
    username: r.username,
    message: r.message ?? "",
    createdAt: r.createdAt,
  }));
};

export const decodePinnedMessagesResponse = (
  input: unknown,
): PinnedMessage[] => {
  const parsed = decodeOrThrow(pinListSchema, input, "groups/pins");
  return parsed.items.map((p) => ({
    messageId: p.messageId,
    content: p.content ?? "",
    author: p.author ?? null,
    pinnedBy: p.pinnedBy ?? null,
    pinnedAt: p.pinnedAt,
    createdAt: p.createdAt ?? p.pinnedAt,
  }));
};

export const decodeBannedMembersResponse = (
  input: unknown,
): { items: BannedMember[]; total: number } => {
  const parsed = decodeOrThrow(bannedListSchema, input, "groups/banned");
  return {
    items: parsed.items.map((b) => ({
      userId: b.userId,
      username: b.username,
      reason: b.reason ?? "",
      bannedBy: b.bannedBy ?? null,
    })),
    total: parsed.total ?? parsed.items.length,
  };
};
