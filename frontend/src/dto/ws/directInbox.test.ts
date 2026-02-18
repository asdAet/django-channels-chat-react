import { describe, expect, it } from 'vitest'

import { decodeDirectInboxWsEvent } from './directInbox'

describe('direct inbox WS DTO decoder', () => {
  it('normalizes unread state with fallback counts', () => {
    const decoded = decodeDirectInboxWsEvent(
      JSON.stringify({ type: 'direct_unread_state', unread: { slugs: ['dm_1'] } }),
    )

    expect(decoded.type).toBe('direct_unread_state')
    if (decoded.type === 'direct_unread_state') {
      expect(decoded.unread.counts).toEqual({ dm_1: 1 })
      expect(decoded.unread.dialogs).toBe(1)
    }
  })

  it('decodes inbox item event', () => {
    const decoded = decodeDirectInboxWsEvent(
      JSON.stringify({
        type: 'direct_inbox_item',
        item: {
          slug: 'dm_1',
          peer: { username: 'alice', profileImage: null },
          lastMessage: 'hey',
          lastMessageAt: '2026-02-18T00:00:00Z',
        },
      }),
    )

    expect(decoded.type).toBe('direct_inbox_item')
    if (decoded.type === 'direct_inbox_item') {
      expect(decoded.item?.peer.username).toBe('alice')
    }
  })

  it('returns unknown for invalid payload', () => {
    expect(decodeDirectInboxWsEvent('[]').type).toBe('unknown')
  })
})
