import { beforeEach, describe, expect, it } from 'vitest'

import {
  readCookieValue,
  readCsrfFromSessionStorage,
  writeCsrfToSessionStorage,
} from './storage'

describe('storage input decoders', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('reads cookie value by name', () => {
    const value = readCookieValue('csrftoken=token123; foo=bar', 'csrftoken')
    expect(value).toBe('token123')
  })

  it('writes and reads csrf from sessionStorage', () => {
    writeCsrfToSessionStorage('csrfToken', 'abc')
    expect(readCsrfFromSessionStorage('csrfToken')).toBe('abc')

    writeCsrfToSessionStorage('csrfToken', null)
    expect(readCsrfFromSessionStorage('csrfToken')).toBeNull()
  })
})
