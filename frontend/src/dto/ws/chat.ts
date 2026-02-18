import { z } from 'zod'

import { parseJson, safeDecode } from '../core/codec'

const rateLimitedSchema = z
  .object({
    error: z.literal('rate_limited'),
    retry_after: z.union([z.number(), z.string()]).optional(),
    retryAfter: z.union([z.number(), z.string()]).optional(),
    retry: z.union([z.number(), z.string()]).optional(),
  })
  .passthrough()

const messageTooLongSchema = z.object({ error: z.literal('message_too_long') }).passthrough()
const forbiddenSchema = z.object({ error: z.literal('forbidden') }).passthrough()

const messageSchema = z
  .object({
    message: z.string(),
    username: z.string().min(1),
    profile_pic: z.string().nullable().optional(),
    room: z.string().optional(),
  })
  .passthrough()

export type ChatWsEvent =
  | {
      type: 'rate_limited'
      retryAfterSeconds: number | null
    }
  | { type: 'message_too_long' }
  | { type: 'forbidden' }
  | {
      type: 'chat_message'
      message: {
        content: string
        username: string
        profilePic: string | null
        room: string | null
      }
    }
  | { type: 'unknown' }

const toNumberOrNull = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

/**
 * Декодирует входящее WS-сообщение комнаты чата.
 * @param raw Сырой JSON payload из websocket.
 * @returns Нормализованное WS-событие.
 */
export const decodeChatWsEvent = (raw: string): ChatWsEvent => {
  const payload = parseJson(raw)
  if (!payload || typeof payload !== 'object') {
    return { type: 'unknown' }
  }

  const rateLimited = safeDecode(rateLimitedSchema, payload)
  if (rateLimited) {
    const retryAfterSeconds =
      toNumberOrNull(rateLimited.retry_after) ??
      toNumberOrNull(rateLimited.retryAfter) ??
      toNumberOrNull(rateLimited.retry)
    return { type: 'rate_limited', retryAfterSeconds }
  }

  if (safeDecode(messageTooLongSchema, payload)) {
    return { type: 'message_too_long' }
  }

  if (safeDecode(forbiddenSchema, payload)) {
    return { type: 'forbidden' }
  }

  const message = safeDecode(messageSchema, payload)
  if (message) {
    return {
      type: 'chat_message',
      message: {
        content: message.message,
        username: message.username,
        profilePic: message.profile_pic ?? null,
        room: message.room ?? null,
      },
    }
  }

  return { type: 'unknown' }
}
