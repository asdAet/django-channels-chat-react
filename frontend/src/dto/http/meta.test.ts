import { describe, expect, it } from 'vitest'

import { decodeClientConfigResponse } from './meta'

describe('dto/http/meta', () => {
  it('decodes valid client config payload', () => {
    const decoded = decodeClientConfigResponse({
      usernameMaxLength: 30,
      chatMessageMaxLength: 1000,
      chatRoomSlugRegex: '^[A-Za-z0-9_-]{3,50}$',
      mediaUrlTtlSeconds: 300,
      mediaMode: 'signed_only',
      extra: true,
    })

    expect(decoded.usernameMaxLength).toBe(30)
    expect(decoded.mediaMode).toBe('signed_only')
  })

  it('throws for invalid payload', () => {
    expect(() => decodeClientConfigResponse({ usernameMaxLength: 0 })).toThrow()
  })
})
