import { beforeEach, describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'

import { apiService, normalizeAxiosError } from './ApiService'
import { server } from '../test/setup'

describe('ApiService', () => {
  /**
   * Выполняет метод `beforeEach`.
   * @returns Результат выполнения `beforeEach`.
   */

  beforeEach(() => {
    sessionStorage.clear()
    document.cookie = 'csrftoken=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
  })

  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('injects csrf token from cookie into write requests', async () => {
    document.cookie = 'csrftoken=cookie-token; path=/'

    let receivedToken: string | null = null
    server.use(
      http.post('/api/auth/login/', async ({ request }) => {
        receivedToken = request.headers.get('x-csrftoken')
        return HttpResponse.json({ authenticated: true, user: null })
      }),
    )

    await apiService.login('demo', 'pass12345')

    /**
     * Выполняет метод `expect`.
     * @param receivedToken Входной параметр `receivedToken`.
     * @returns Результат выполнения `expect`.
     */

    expect(receivedToken).toBe('cookie-token')
  })

  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('stores csrf token in sessionStorage and uses it as fallback', async () => {
    server.use(
      http.get('/api/auth/csrf/', () => HttpResponse.json({ csrfToken: 'stored-token' })),
    )

    await apiService.ensureCsrf()

    let receivedToken: string | null = null
    server.use(
      http.post('/api/auth/login/', async ({ request }) => {
        receivedToken = request.headers.get('x-csrftoken')
        return HttpResponse.json({ authenticated: true, user: null })
      }),
    )

    await apiService.login('demo', 'pass12345')

    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(sessionStorage.getItem('csrfToken')).toBe('stored-token')
    /**
     * Выполняет метод `expect`.
     * @param receivedToken Входной параметр `receivedToken`.
     * @returns Результат выполнения `expect`.
     */

    expect(receivedToken).toBe('stored-token')
  })

  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('sends multipart form data for profile update', async () => {
    let contentType = ''

    server.use(
      http.post('*/api/auth/profile/', async ({ request }) => {
        contentType = request.headers.get('content-type') || ''
        return HttpResponse.json({
          user: {
            username: 'updated',
            email: 'updated@example.com',
            profileImage: null,
            bio: 'about me',
            lastSeen: null,
            registeredAt: null,
          },
        })
      }),
    )

    const response = await apiService.updateProfile({
      username: 'updated',
      email: 'updated@example.com',
      bio: 'about me',
    })

    /**
     * Выполняет метод `expect`.
     * @param contentType Входной параметр `contentType`.
     * @returns Результат выполнения `expect`.
     */

    expect(contentType).toContain('multipart/form-data')
    /**
     * Выполняет метод `expect`.
     * @param contentType Входной параметр `contentType`.
     * @returns Результат выполнения `expect`.
     */

    expect(contentType).not.toContain('application/json')
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(response.user.username).toBe('updated')
  })

  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('normalizes axios errors to ApiError shape', async () => {
    server.use(
      http.post('/api/auth/register/', () => {
        return HttpResponse.json(
          { errors: { username: ['already used'] } },
          { status: 400 },
        )
      }),
    )

    await expect(apiService.register('taken', 'pass12345', 'pass12345')).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining('already used'),
      data: expect.objectContaining({ errors: expect.any(Object) }),
    })
  })

  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('normalizes string server errors', async () => {
    server.use(
      http.post('/api/auth/register/', () =>
        new HttpResponse('fatal error', { status: 500 }),
      ),
    )

    await expect(apiService.register('name', 'pass12345', 'pass12345')).rejects.toMatchObject({
      status: 500,
      message: expect.stringContaining('fatal error'),
    })
  })

  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('normalizes detail payload errors', async () => {
    server.use(
      http.post('/api/auth/login/', () =>
        HttpResponse.json({ detail: 'forbidden' }, { status: 403 }),
      ),
    )

    await expect(apiService.login('demo', 'pass12345')).rejects.toMatchObject({
      status: 403,
      message: expect.stringContaining('forbidden'),
      data: expect.objectContaining({ detail: 'forbidden' }),
    })
  })

  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('supports read endpoints and room query params', async () => {
    let beforeParam: string | null = null
    let encodedUserPath = ''
    let sessionCsrfHeader: string | null = 'init'

    server.use(
      http.get('/api/auth/session/', ({ request }) => {
        sessionCsrfHeader = request.headers.get('x-csrftoken')
        return HttpResponse.json({ authenticated: false, user: null })
      }),
      http.get('/api/auth/password-rules/', () => HttpResponse.json({ rules: ['min length'] })),
      http.get('/api/auth/users/:username/', ({ params }) => {
        encodedUserPath = String(params.username)
        return HttpResponse.json({
          user: {
            username: String(params.username),
            email: '',
            profileImage: null,
            bio: '',
            lastSeen: null,
            registeredAt: null,
          },
        })
      }),
      http.get('/api/chat/public-room/', () =>
        HttpResponse.json({ slug: 'public', name: 'Public', kind: 'public', created: false, createdBy: null }),
      ),
      http.get('/api/chat/rooms/:slug/', ({ params }) =>
        HttpResponse.json({ slug: String(params.slug), name: 'Room', kind: 'private', created: false, createdBy: null }),
      ),
      http.get('/api/chat/rooms/:slug/messages/', ({ request }) => {
        beforeParam = new URL(request.url).searchParams.get('before')
        return HttpResponse.json({
          messages: [],
          pagination: { limit: 50, hasMore: false, nextBefore: null },
        })
      }),
      http.post('/api/auth/logout/', () => HttpResponse.json({ ok: true })),
    )

    const session = await apiService.getSession()
    const rules = await apiService.getPasswordRules()
    const publicRoom = await apiService.getPublicRoom()
    const room = await apiService.getRoomDetails('public')
    const roomMessages = await apiService.getRoomMessages('public', { limit: 50, beforeId: 123 })
    const profile = await apiService.getUserProfile('user name')
    const logout = await apiService.logout()

    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(session.authenticated).toBe(false)
    /**
     * Выполняет метод `expect`.
     * @param sessionCsrfHeader Входной параметр `sessionCsrfHeader`.
     * @returns Результат выполнения `expect`.
     */

    expect(sessionCsrfHeader).toBeNull()
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(rules.rules).toEqual(['min length'])
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(publicRoom.slug).toBe('public')
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(room.slug).toBe('public')
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(roomMessages.messages).toEqual([])
    /**
     * Выполняет метод `expect`.
     * @param beforeParam Входной параметр `beforeParam`.
     * @returns Результат выполнения `expect`.
     */

    expect(beforeParam).toBe('123')
    /**
     * Выполняет метод `expect`.
     * @param encodedUserPath Входной параметр `encodedUserPath`.
     * @returns Результат выполнения `expect`.
     */

    expect(encodedUserPath).toBe('user name')
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(profile.user.username).toBe('user name')
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(logout.ok).toBe(true)
  })


  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('keeps already-normalized ApiError objects intact', () => {
    const normalized = normalizeAxiosError({ status: 418, message: 'teapot' })
    /**
     * Выполняет метод `expect`.
     * @param normalized Входной параметр `normalized`.
     * @returns Результат выполнения `expect`.
     */

    expect(normalized).toEqual({ status: 418, message: 'teapot' })
  })

  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('returns fallback for unknown error shapes', () => {
    const normalized = normalizeAxiosError(new Error('unknown'))
    /**
     * Выполняет метод `expect`.
     * @param normalized Входной параметр `normalized`.
     * @returns Результат выполнения `expect`.
     */

    expect(normalized).toEqual({ status: 0, message: 'Request failed' })
  })

})