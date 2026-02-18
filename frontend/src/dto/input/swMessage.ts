import { z } from 'zod'

import { decodeOrThrow, safeDecode } from '../core/codec'

const invalidateMessageSchema = z
  .object({
    type: z.literal('invalidate'),
    key: z.enum(['roomMessages', 'roomDetails', 'directChats', 'userProfile', 'selfProfile']),
    slug: z.string().trim().min(1).optional(),
    username: z.string().trim().min(1).optional(),
  })
  .strict()

const clearMessageSchema = z
  .object({
    type: z.literal('clearUserCaches'),
  })
  .strict()

const swMessageSchema = z.union([invalidateMessageSchema, clearMessageSchema])

const hasRequiredDiscriminatorFields = (
  message: z.infer<typeof swMessageSchema>,
): message is z.infer<typeof swMessageSchema> => {
  if (message.type !== 'invalidate') return true
  if (message.key === 'roomMessages' || message.key === 'roomDetails') {
    return Boolean(message.slug)
  }
  if (message.key === 'userProfile') {
    return Boolean(message.username)
  }
  return true
}

export type SwCacheMessage = z.infer<typeof swMessageSchema>

/**
 * Валидирует исходящее сообщение в Service Worker.
 * @param input Сырой payload.
 * @returns Валидированный payload.
 */
export const encodeSwCacheMessage = (input: unknown): SwCacheMessage => {
  const message = decodeOrThrow(swMessageSchema, input, 'sw/cache-message')
  if (!hasRequiredDiscriminatorFields(message)) {
    throw new Error('Invalid sw cache message payload')
  }
  return message
}

/**
 * Безопасно декодирует входящее сообщение в Service Worker.
 * @param input Сырой payload.
 * @returns Валидированный payload или null.
 */
export const decodeSwCacheMessage = (input: unknown): SwCacheMessage | null => {
  const message = safeDecode(swMessageSchema, input)
  if (!message) return null
  return hasRequiredDiscriminatorFields(message) ? message : null
}
