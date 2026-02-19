import { z } from 'zod'

import { getChatRoomSlugRegExp } from '../../shared/config/limits'

const usernameSchema = z
  .string()
  .transform((value) => (value.startsWith('@') ? value.slice(1) : value))
  .transform((value) => value.trim())
  .refine((value) => value.length > 0, 'Username is required')

/**
 * Декодирует slug комнаты из route-параметра.
 * @param value Сырое значение из маршрута.
 * @returns Валидный slug или null.
 */
export const decodeRoomSlugParam = (value: unknown): string | null => {
  const roomSlugSchema = z.string().regex(getChatRoomSlugRegExp())
  const parsed = roomSlugSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

/**
 * Декодирует username из route-параметра.
 * @param value Сырое значение из маршрута.
 * @returns Валидный username без префикса @ или null.
 */
export const decodeUsernameParam = (value: unknown): string | null => {
  const parsed = usernameSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}
