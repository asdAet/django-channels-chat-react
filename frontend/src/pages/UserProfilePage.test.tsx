import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { UserProfile } from '../entities/user/types'

const SEND_DM_LABEL = 'Отправить сообщение'

const profileMock = vi.hoisted(() => ({
  user: {
    username: 'alice',
    email: '',
    profileImage: null,
    bio: '',
    lastSeen: null as string | null,
    registeredAt: null,
  } as UserProfile,
  loading: false,
  error: null as string | null,
}))

vi.mock('../hooks/useUserProfile', () => ({
  useUserProfile: () => profileMock,
}))

const presenceMock = vi.hoisted(() => ({
  online: [] as Array<{ username: string; profileImage: string | null }>,
  guests: 0,
  status: 'online' as const,
  lastError: null as string | null,
}))

vi.mock('../shared/presence', () => ({
  usePresence: () => presenceMock,
}))

import { UserProfilePage } from './UserProfilePage'

/**
 * Выполняет функцию `makeUser`.
 * @param username Входной параметр `username`.
 * @returns Результат выполнения `makeUser`.
 */

const makeUser = (username: string) => ({
  username,
  email: `${username}@example.com`,
  profileImage: null,
  bio: '',
  lastSeen: null as string | null,
  registeredAt: null,
}) as UserProfile

describe('UserProfilePage', () => {
  /**
   * Выполняет метод `beforeEach`.
   * @returns Результат выполнения `beforeEach`.
   */

  beforeEach(() => {
    profileMock.user = {
      username: 'alice',
      email: '',
      profileImage: null,
      bio: '',
      lastSeen: null as string | null,
      registeredAt: null,
    }
    profileMock.loading = false
    profileMock.error = null
    presenceMock.online = []
    presenceMock.status = 'online'
    presenceMock.lastError = null
  })

  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('shows send message button only for foreign profile', () => {
    const onNavigate = vi.fn()

    /**
     * Выполняет метод `render`.
     * @returns Результат выполнения `render`.
     */

    render(
      <UserProfilePage
        user={makeUser('bob')}
        currentUser={makeUser('bob')}
        username="alice"
        onNavigate={onNavigate}
        onLogout={vi.fn()}
      />,
    )

    const button = screen.getByRole('button', { name: SEND_DM_LABEL })
    fireEvent.click(button)
    /**
     * Выполняет метод `expect`.
     * @param onNavigate Входной параметр `onNavigate`.
     * @returns Результат выполнения `expect`.
     */

    expect(onNavigate).toHaveBeenCalledWith('/direct/@alice')
  })

  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('hides send message button for own profile', () => {
    /**
     * Выполняет метод `render`.
     * @returns Результат выполнения `render`.
     */

    render(
      <UserProfilePage
        user={makeUser('alice')}
        currentUser={makeUser('alice')}
        username="alice"
        onNavigate={vi.fn()}
        onLogout={vi.fn()}
      />,
    )

    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(screen.queryByRole('button', { name: SEND_DM_LABEL })).toBeNull()
  })

  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('shows online label when user is online', () => {
    presenceMock.online = [{ username: 'alice', profileImage: null }]

    const { container } = render(
      <UserProfilePage
        user={makeUser('bob')}
        currentUser={makeUser('bob')}
        username="alice"
        onNavigate={vi.fn()}
        onLogout={vi.fn()}
      />,
    )

    expect(container.querySelector('.profile_avatar_wrapper.is-online')).not.toBeNull()
  })

  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('shows last seen label when user is offline', () => {
    profileMock.user = {
      username: 'alice',
      email: '',
      profileImage: null,
      bio: '',
      lastSeen: '2026-02-13T10:00:00.000Z',
      registeredAt: null,
    }

    const { container } = render(
      <UserProfilePage
        user={makeUser('bob')}
        currentUser={makeUser('bob')}
        username="alice"
        onNavigate={vi.fn()}
        onLogout={vi.fn()}
      />,
    )

    expect(container.querySelector('.profile_avatar_wrapper.is-online')).toBeNull()
  })
})
