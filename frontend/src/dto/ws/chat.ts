import { z } from "zod";

import { parseJson, safeDecode } from "../core/codec";

const avatarCropSchema = z
  .object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  })
  .passthrough();

const rateLimitedSchema = z
  .object({
    error: z.literal("rate_limited"),
    retry_after: z.union([z.number(), z.string()]).optional(),
    retryAfter: z.union([z.number(), z.string()]).optional(),
    retry: z.union([z.number(), z.string()]).optional(),
  })
  .passthrough();

const messageTooLongSchema = z
  .object({ error: z.literal("message_too_long") })
  .passthrough();
const forbiddenSchema = z
  .object({ error: z.literal("forbidden") })
  .passthrough();

const replyToSchema = z
  .object({
    id: z.number(),
    username: z.string().nullable(),
    content: z.string(),
  })
  .passthrough();

const attachmentWsSchema = z
  .object({
    id: z.number(),
    originalFilename: z.string(),
    contentType: z.string(),
    fileSize: z.number(),
    url: z.string().nullable().optional(),
    thumbnailUrl: z.string().nullable().optional(),
    width: z.number().nullable().optional(),
    height: z.number().nullable().optional(),
  })
  .passthrough();

const messageSchema = z
  .object({
    message: z.string(),
    username: z.string().min(1),
    profile_pic: z.string().nullable().optional(),
    avatar_crop: avatarCropSchema.nullable().optional(),
    room: z.string().optional(),
    id: z.number().optional(),
    createdAt: z.string().optional(),
    replyTo: replyToSchema.nullable().optional(),
    attachments: z.array(attachmentWsSchema).optional(),
  })
  .passthrough();

const typingSchema = z
  .object({
    type: z.literal("typing"),
    username: z.string(),
    userId: z.number(),
  })
  .passthrough();

const messageEditSchema = z
  .object({
    type: z.literal("message_edit"),
    messageId: z.number(),
    content: z.string(),
    editedAt: z.string(),
    editedBy: z.string(),
  })
  .passthrough();

const messageDeleteSchema = z
  .object({
    type: z.literal("message_delete"),
    messageId: z.number(),
    deletedBy: z.string(),
  })
  .passthrough();

const reactionAddSchema = z
  .object({
    type: z.literal("reaction_add"),
    messageId: z.number(),
    emoji: z.string(),
    userId: z.number(),
    username: z.string(),
  })
  .passthrough();

const reactionRemoveSchema = z
  .object({
    type: z.literal("reaction_remove"),
    messageId: z.number(),
    emoji: z.string(),
    userId: z.number(),
    username: z.string(),
  })
  .passthrough();

const readReceiptSchema = z
  .object({
    type: z.literal("read_receipt"),
    userId: z.number(),
    username: z.string(),
    lastReadMessageId: z.number(),
    roomSlug: z.string(),
  })
  .passthrough();

export type ChatWsEvent =
  | {
      type: "rate_limited";
      retryAfterSeconds: number | null;
    }
  | { type: "message_too_long" }
  | { type: "forbidden" }
  | {
      type: "chat_message";
      message: {
        id: number | null;
        content: string;
        username: string;
        profilePic: string | null;
        avatarCrop: {
          x: number;
          y: number;
          width: number;
          height: number;
        } | null;
        room: string | null;
        createdAt: string | null;
        replyTo: {
          id: number;
          username: string | null;
          content: string;
        } | null;
        attachments: {
          id: number;
          originalFilename: string;
          contentType: string;
          fileSize: number;
          url: string | null;
          thumbnailUrl: string | null;
          width: number | null;
          height: number | null;
        }[];
      };
    }
  | {
      type: "typing";
      username: string;
      userId: number;
    }
  | {
      type: "message_edit";
      messageId: number;
      content: string;
      editedAt: string;
      editedBy: string;
    }
  | {
      type: "message_delete";
      messageId: number;
      deletedBy: string;
    }
  | {
      type: "reaction_add";
      messageId: number;
      emoji: string;
      userId: number;
      username: string;
    }
  | {
      type: "reaction_remove";
      messageId: number;
      emoji: string;
      userId: number;
      username: string;
    }
  | {
      type: "read_receipt";
      userId: number;
      username: string;
      lastReadMessageId: number;
      roomSlug: string;
    }
  | { type: "unknown" };

const toNumberOrNull = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

/**
 * Декодирует входящее WS-сообщение комнаты чата.
 * @param raw Сырой JSON payload из websocket.
 * @returns Нормализованное WS-событие.
 */
export const decodeChatWsEvent = (raw: string): ChatWsEvent => {
  const payload = parseJson(raw);
  if (!payload || typeof payload !== "object") {
    return { type: "unknown" };
  }

  const rateLimited = safeDecode(rateLimitedSchema, payload);
  if (rateLimited) {
    const retryAfterSeconds =
      toNumberOrNull(rateLimited.retry_after) ??
      toNumberOrNull(rateLimited.retryAfter) ??
      toNumberOrNull(rateLimited.retry);
    return { type: "rate_limited", retryAfterSeconds };
  }

  if (safeDecode(messageTooLongSchema, payload)) {
    return { type: "message_too_long" };
  }

  if (safeDecode(forbiddenSchema, payload)) {
    return { type: "forbidden" };
  }

  // Typed events (have a "type" field)
  const typed = safeDecode(typingSchema, payload);
  if (typed) {
    return { type: "typing", username: typed.username, userId: typed.userId };
  }

  const edit = safeDecode(messageEditSchema, payload);
  if (edit) {
    return {
      type: "message_edit",
      messageId: edit.messageId,
      content: edit.content,
      editedAt: edit.editedAt,
      editedBy: edit.editedBy,
    };
  }

  const del = safeDecode(messageDeleteSchema, payload);
  if (del) {
    return {
      type: "message_delete",
      messageId: del.messageId,
      deletedBy: del.deletedBy,
    };
  }

  const reactAdd = safeDecode(reactionAddSchema, payload);
  if (reactAdd) {
    return {
      type: "reaction_add",
      messageId: reactAdd.messageId,
      emoji: reactAdd.emoji,
      userId: reactAdd.userId,
      username: reactAdd.username,
    };
  }

  const reactRemove = safeDecode(reactionRemoveSchema, payload);
  if (reactRemove) {
    return {
      type: "reaction_remove",
      messageId: reactRemove.messageId,
      emoji: reactRemove.emoji,
      userId: reactRemove.userId,
      username: reactRemove.username,
    };
  }

  const receipt = safeDecode(readReceiptSchema, payload);
  if (receipt) {
    return {
      type: "read_receipt",
      userId: receipt.userId,
      username: receipt.username,
      lastReadMessageId: receipt.lastReadMessageId,
      roomSlug: receipt.roomSlug,
    };
  }

  // Chat message (no "type" field)
  const message = safeDecode(messageSchema, payload);
  if (message) {
    return {
      type: "chat_message",
      message: {
        id: message.id ?? null,
        content: message.message,
        username: message.username,
        profilePic: message.profile_pic ?? null,
        avatarCrop: message.avatar_crop ?? null,
        room: message.room ?? null,
        createdAt: message.createdAt ?? null,
        replyTo: message.replyTo ?? null,
        attachments: (message.attachments ?? []).map((a) => ({
          id: a.id,
          originalFilename: a.originalFilename,
          contentType: a.contentType,
          fileSize: a.fileSize,
          url: a.url ?? null,
          thumbnailUrl: a.thumbnailUrl ?? null,
          width: a.width ?? null,
          height: a.height ?? null,
        })),
      },
    };
  }

  return { type: "unknown" };
};
