import { z } from 'zod'

import type { OnlineUser } from '../../shared/api/users'
import { parseJson, safeDecode } from '../core/codec'

const onlineUserSchema = z
  .object({
    username: z.string().min(1),
    profileImage: z.string().nullable().optional(),
  })
  .passthrough()

const presenceStateSchema = z
  .object({
    online: z.array(onlineUserSchema).optional(),
    guests: z.union([z.number(), z.string()]).optional(),
  })
  .passthrough()

const pingSchema = z.object({ type: z.literal('ping') }).passthrough()

const toGuests = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export type PresenceWsEvent =
  | {
      type: 'state'
      online: OnlineUser[] | null
      guests: number | null
    }
  | { type: 'ping' }
  | { type: 'unknown' }

/**
 * Декодирует входящее WS-сообщение presence.
 * @param raw Сырой JSON payload из websocket.
 * @returns Нормализованное WS-событие.
 */
export const decodePresenceWsEvent = (raw: string): PresenceWsEvent => {
  const payload = parseJson(raw)
  if (!payload || typeof payload !== 'object') {
    return { type: 'unknown' }
  }

  if (safeDecode(pingSchema, payload)) {
    return { type: 'ping' }
  }

  const state = safeDecode(presenceStateSchema, payload)
  if (!state) {
    return { type: 'unknown' }
  }

  return {
    type: 'state',
    online: state.online
      ? state.online.map((entry) => ({
          username: entry.username,
          profileImage: entry.profileImage ?? null,
        }))
      : null,
    guests: toGuests(state.guests),
  }
}
