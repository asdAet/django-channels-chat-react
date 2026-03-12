import { z } from "zod";

import type {
  MemberRoles,
  MyPermissions,
  PermissionOverride,
  Role,
} from "../../entities/role/types";
import { decodeOrThrow } from "../core/codec";

const roleSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    color: z.string().optional(),
    position: z.number().optional(),
    permissions: z.number().optional(),
    isDefault: z.boolean().optional(),
    is_default: z.boolean().optional(),
    createdAt: z.string().optional(),
    created_at: z.string().optional(),
  })
  .passthrough();

const roleListSchema = z.object({ items: z.array(roleSchema) }).passthrough();

const memberRolesSchema = z
  .object({
    item: z
      .object({
        userId: z.number(),
        username: z.string(),
        roleIds: z.array(z.number()),
        roles: z.array(z.union([z.string(), roleSchema])),
        isBanned: z.boolean().optional(),
        is_banned: z.boolean().optional(),
        joinedAt: z.string().optional(),
        joined_at: z.string().optional(),
      })
      .passthrough(),
  })
  .passthrough();

const overrideSchema = z
  .object({
    id: z.number(),
    targetRoleId: z.number().nullable().optional(),
    targetUserId: z.number().nullable().optional(),
    allow: z.number().optional(),
    deny: z.number().optional(),
  })
  .passthrough();

const overrideListSchema = z
  .object({ items: z.array(overrideSchema) })
  .passthrough();

const myPermissionsSchema = z
  .object({
    permissions: z.number(),
    roles: z.array(z.number()).optional(),
    isMember: z.boolean().optional(),
    isBanned: z.boolean().optional(),
    canJoin: z.boolean().optional(),
  })
  .passthrough();

const mapRole = (dto: z.infer<typeof roleSchema>): Role => ({
  id: dto.id,
  name: dto.name,
  color: dto.color ?? "#99AAB5",
  position: dto.position ?? 0,
  permissions: dto.permissions ?? 0,
  isDefault: dto.isDefault ?? dto.is_default ?? false,
  createdAt: dto.createdAt ?? dto.created_at ?? "",
});

export const decodeRolesListResponse = (input: unknown): Role[] => {
  const parsed = decodeOrThrow(roleListSchema, input, "roles/list");
  return parsed.items.map(mapRole);
};

export const decodeRoleResponse = (input: unknown): Role => {
  const wrapped = z.object({ item: roleSchema }).passthrough();
  const parsed = decodeOrThrow(wrapped, input, "roles/single");
  return mapRole(parsed.item);
};

export const decodeMemberRolesResponse = (input: unknown): MemberRoles => {
  const parsed = decodeOrThrow(memberRolesSchema, input, "roles/member");
  return {
    userId: parsed.item.userId,
    username: parsed.item.username,
    roleIds: parsed.item.roleIds,
    roles: parsed.item.roles.map((role) =>
      typeof role === "string" ? role : role.name,
    ),
    isBanned: parsed.item.isBanned ?? parsed.item.is_banned ?? false,
    joinedAt: parsed.item.joinedAt ?? parsed.item.joined_at ?? "",
  };
};

export const decodeOverridesResponse = (
  input: unknown,
): PermissionOverride[] => {
  const parsed = decodeOrThrow(overrideListSchema, input, "roles/overrides");
  return parsed.items.map((o) => ({
    id: o.id,
    targetRoleId: o.targetRoleId ?? null,
    targetUserId: o.targetUserId ?? null,
    allow: o.allow ?? 0,
    deny: o.deny ?? 0,
  }));
};

export const decodeOverrideResponse = (input: unknown): PermissionOverride => {
  const wrapped = z.object({ item: overrideSchema }).passthrough();
  const parsed = decodeOrThrow(wrapped, input, "roles/override");
  return {
    id: parsed.item.id,
    targetRoleId: parsed.item.targetRoleId ?? null,
    targetUserId: parsed.item.targetUserId ?? null,
    allow: parsed.item.allow ?? 0,
    deny: parsed.item.deny ?? 0,
  };
};

export const decodeMyPermissionsResponse = (input: unknown): MyPermissions => {
  return decodeOrThrow(myPermissionsSchema, input, "roles/my-permissions");
};
