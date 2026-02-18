import { describe, expect, it } from 'vitest'

import { decodePresenceWsEvent } from './presence'

describe('presence WS DTO decoder', () => {
  it('decodes state event', () => {
    const decoded = decodePresenceWsEvent(
      JSON.stringify({
        online: [{ username: 'alice', profileImage: null }],
        guests: '2',
      }),
    )

    expect(decoded).toEqual({
      type: 'state',
      online: [{ username: 'alice', profileImage: null }],
      guests: 2,
    })
  })

  it('decodes ping event', () => {
    expect(decodePresenceWsEvent(JSON.stringify({ type: 'ping' }))).toEqual({ type: 'ping' })
  })
})
