import { describe, expect, it } from 'vitest'

import { decodeRoomSlugParam, decodeUsernameParam } from './route'

describe('route input decoders', () => {
  it('validates room slug', () => {
    expect(decodeRoomSlugParam('public_room')).toBe('public_room')
    expect(decodeRoomSlugParam('bad slug')).toBeNull()
  })

  it('normalizes username', () => {
    expect(decodeUsernameParam('@alice')).toBe('alice')
    expect(decodeUsernameParam('   ')).toBeNull()
  })
})
