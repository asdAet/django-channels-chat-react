import { z } from 'zod'

import type { DirectChatListItem } from '../../entities/room/types'
import { parseJson, safeDecode } from '../core/codec'

const unreadSchema = z
  .object({
    dialogs: z.number().optional(),
    slugs: z.array(z.string()).optional(),
    counts: z.record(z.string(), z.union([z.number(), z.string()])).optional(),
  })
  .passthrough()

const itemSchema = z
  .object({
    slug: z.string().min(1),
    peer: z
      .object({
        username: z.string().min(1),
        profileImage: z.string().nullable().optional(),
      })
      .passthrough(),
    lastMessage: z.string().optional(),
    lastMessageAt: z.string().optional(),
  })
  .passthrough()

const unreadStateEventSchema = z
  .object({
    type: z.literal('direct_unread_state'),
    unread: unreadSchema.optional(),
  })
  .passthrough()

const inboxItemEventSchema = z
  .object({
    type: z.literal('direct_inbox_item'),
    item: itemSchema.optional(),
    unread: unreadSchema.optional(),
  })
  .passthrough()

const markReadAckEventSchema = z
  .object({
    type: z.literal('direct_mark_read_ack'),
    unread: unreadSchema.optional(),
  })
  .passthrough()

const errorEventSchema = z
  .object({
    type: z.literal('error'),
    code: z.string().optional(),
  })
  .passthrough()

const normalizeUnread = (
  value: z.infer<typeof unreadSchema> | undefined,
): { dialogs: number; slugs: string[]; counts: Record<string, number> } => {
  if (!value) return { dialogs: 0, slugs: [], counts: {} }

  const counts: Record<string, number> = {}
  const rawCounts = value.counts ?? {}
  for (const [slug, raw] of Object.entries(rawCounts)) {
    const key = slug.trim()
    if (!key) continue
    const parsed = typeof raw === 'string' ? Number(raw) : raw
    if (!Number.isFinite(parsed) || parsed <= 0) continue
    counts[key] = Math.floor(parsed)
  }

  const slugsFromPayload = Array.isArray(value.slugs)
    ? value.slugs.filter((slug) => typeof slug === 'string' && slug.trim().length > 0)
    : []

  if (!Object.keys(counts).length) {
    for (const slug of slugsFromPayload) {
      counts[slug] = 1
    }
  }

  const slugs = Object.keys(counts)
  const dialogs = typeof value.dialogs === 'number' ? Math.max(0, value.dialogs) : slugs.length

  return { dialogs, slugs, counts }
}

const normalizeItem = (value: z.infer<typeof itemSchema>): DirectChatListItem => ({
  slug: value.slug,
  peer: {
    username: value.peer.username,
    profileImage: value.peer.profileImage ?? null,
  },
  lastMessage: value.lastMessage ?? '',
  lastMessageAt: value.lastMessageAt ?? new Date().toISOString(),
})

export type DirectInboxWsEvent =
  | {
      type: 'direct_unread_state'
      unread: { dialogs: number; slugs: string[]; counts: Record<string, number> }
    }
  | {
      type: 'direct_inbox_item'
      item: DirectChatListItem | null
      unread: { dialogs: number; slugs: string[]; counts: Record<string, number> } | null
    }
  | {
      type: 'direct_mark_read_ack'
      unread: { dialogs: number; slugs: string[]; counts: Record<string, number> }
    }
  | { type: 'error'; code: string }
  | { type: 'unknown' }

/**
 * Декодирует входящее WS-сообщение direct inbox.
 * @param raw Сырой JSON payload из websocket.
 * @returns Нормализованное WS-событие.
 */
export const decodeDirectInboxWsEvent = (raw: string): DirectInboxWsEvent => {
  const payload = parseJson(raw)
  if (!payload || typeof payload !== 'object') {
    return { type: 'unknown' }
  }

  const unreadState = safeDecode(unreadStateEventSchema, payload)
  if (unreadState) {
    return {
      type: 'direct_unread_state',
      unread: normalizeUnread(unreadState.unread),
    }
  }

  const inboxItem = safeDecode(inboxItemEventSchema, payload)
  if (inboxItem) {
    return {
      type: 'direct_inbox_item',
      item: inboxItem.item ? normalizeItem(inboxItem.item) : null,
      unread: inboxItem.unread ? normalizeUnread(inboxItem.unread) : null,
    }
  }

  const markReadAck = safeDecode(markReadAckEventSchema, payload)
  if (markReadAck) {
    return {
      type: 'direct_mark_read_ack',
      unread: normalizeUnread(markReadAck.unread),
    }
  }

  const errorEvent = safeDecode(errorEventSchema, payload)
  if (errorEvent) {
    return {
      type: 'error',
      code: errorEvent.code ?? 'unknown',
    }
  }

  return { type: 'unknown' }
}
