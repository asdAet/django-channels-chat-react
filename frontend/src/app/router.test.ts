import { describe, expect, it, vi } from 'vitest'

import { navigate, parseRoute } from './router'

describe('router', () => {
  it('parses known routes and trims trailing slash', () => {
    expect(parseRoute('/')).toEqual({ name: 'home' })
    expect(parseRoute('/login/')).toEqual({ name: 'login' })
    expect(parseRoute('/register/')).toEqual({ name: 'register' })
    expect(parseRoute('/profile/')).toEqual({ name: 'profile' })
    expect(parseRoute('/rooms/public/')).toEqual({ name: 'room', slug: 'public' })
  })

  it('returns home for invalid room slug', () => {
    expect(parseRoute('/rooms/a')).toEqual({ name: 'home' })
    expect(parseRoute('/rooms/public/bad')).toEqual({ name: 'home' })
  })

  it('parses user route with url decoding', () => {
    expect(parseRoute('/users/test%20user')).toEqual({ name: 'user', username: 'test user' })
  })

  it('navigate updates history and route state', () => {
    const replaceSpy = vi.spyOn(window.history, 'pushState')
    const setRoute = vi.fn()

    navigate('/rooms/public', setRoute)

    expect(replaceSpy).toHaveBeenCalled()
    expect(setRoute).toHaveBeenCalledWith({ name: 'room', slug: 'public' })
  })
})
