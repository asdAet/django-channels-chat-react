import { describe, expect, it, vi } from 'vitest'

import { navigate, parseRoute } from './router'

describe('router', () => {
  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('parses known routes and trims trailing slash', () => {
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(parseRoute('/')).toEqual({ name: 'home' })
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(parseRoute('/login/')).toEqual({ name: 'login' })
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(parseRoute('/register/')).toEqual({ name: 'register' })
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(parseRoute('/profile/')).toEqual({ name: 'profile' })
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(parseRoute('/direct/')).toEqual({ name: 'directInbox' })
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(parseRoute('/rooms/public/')).toEqual({ name: 'room', slug: 'public' })
  })

  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('parses direct username route', () => {
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(parseRoute('/direct/@alice')).toEqual({ name: 'directByUsername', username: 'alice' })
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(parseRoute('/direct/@user%20name')).toEqual({ name: 'directByUsername', username: 'user name' })
  })

  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('returns home for invalid room slug and malformed direct path', () => {
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(parseRoute('/rooms/a')).toEqual({ name: 'home' })
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(parseRoute('/rooms/public/bad')).toEqual({ name: 'home' })
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(parseRoute('/direct/@')).toEqual({ name: 'home' })
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(parseRoute('/direct/@alice/extra')).toEqual({ name: 'home' })
  })

  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('parses user route with url decoding', () => {
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(parseRoute('/users/test%20user')).toEqual({ name: 'user', username: 'test user' })
  })

  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('navigate updates history and route state', () => {
    const replaceSpy = vi.spyOn(window.history, 'pushState')
    const setRoute = vi.fn()

    /**
     * Выполняет метод `navigate`.
     * @param setRoute Входной параметр `setRoute`.
     * @returns Результат выполнения `navigate`.
     */

    navigate('/rooms/public', setRoute)

    /**
     * Выполняет метод `expect`.
     * @param replaceSpy Входной параметр `replaceSpy`.
     * @returns Результат выполнения `expect`.
     */

    expect(replaceSpy).toHaveBeenCalled()
    /**
     * Выполняет метод `expect`.
     * @param setRoute Входной параметр `setRoute`.
     * @returns Результат выполнения `expect`.
     */

    expect(setRoute).toHaveBeenCalledWith({ name: 'room', slug: 'public' })
  })
})
