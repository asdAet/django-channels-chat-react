import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const inboxMock = vi.hoisted(() => ({
  items: [] as Array<{
    slug: string
    peer: { username: string; profileImage: string | null }
    lastMessage: string
    lastMessageAt: string
  }>,
  loading: false,
  error: null as string | null,
  unreadSlugs: [] as string[],
  unreadCounts: {} as Record<string, number>,
  unreadDialogsCount: 0,
  status: 'online' as const,
  setActiveRoom: vi.fn<(roomSlug: string | null) => void>(),
  markRead: vi.fn<(roomSlug: string) => void>(),
  refresh: vi.fn<() => Promise<void>>(),
}))

const presenceMock = vi.hoisted(() => ({
  online: [] as Array<{ username: string; profileImage: string | null }>,
  guests: 0,
  status: 'online' as const,
  lastError: null as string | null,
}))

vi.mock('../shared/directInbox', () => ({
  useDirectInbox: () => inboxMock,
}))

vi.mock('../shared/presence', () => ({
  usePresence: () => presenceMock,
}))

import { DirectChatsPage } from './DirectChatsPage'

const user = {
  username: 'demo',
  email: 'demo@example.com',
  profileImage: null,
  bio: '',
  lastSeen: null,
  registeredAt: null,
}

describe('DirectChatsPage', () => {
  /**
   * Выполняет метод `beforeEach`.
   * @returns Результат выполнения `beforeEach`.
   */

  beforeEach(() => {
    inboxMock.items = []
    inboxMock.loading = false
    inboxMock.error = null
    inboxMock.unreadCounts = {}
    inboxMock.setActiveRoom.mockReset()
    inboxMock.refresh.mockReset().mockResolvedValue(undefined)
    presenceMock.online = []
    presenceMock.status = 'online'
    presenceMock.lastError = null
  })

  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('shows auth prompt for guests', () => {
    const onNavigate = vi.fn()
    /**
     * Выполняет метод `render`.
     * @returns Результат выполнения `render`.
     */

    render(<DirectChatsPage user={null} onNavigate={onNavigate} />)

    fireEvent.click(screen.getByRole('button', { name: 'Войти' }))
    /**
     * Выполняет метод `expect`.
     * @param onNavigate Входной параметр `onNavigate`.
     * @returns Результат выполнения `expect`.
     */

    expect(onNavigate).toHaveBeenCalledWith('/login')
  })

  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('shows empty state', () => {
    /**
     * Выполняет метод `render`.
     * @returns Результат выполнения `render`.
     */

    render(<DirectChatsPage user={user} onNavigate={vi.fn()} />)

    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(screen.getByText('Пока нет личных сообщений')).toBeInTheDocument()
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(inboxMock.refresh).toHaveBeenCalledTimes(1)
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(inboxMock.setActiveRoom).toHaveBeenCalledWith(null)
  })

  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('navigates to direct chat item', () => {
    const onNavigate = vi.fn()
    inboxMock.items = [
      {
        slug: 'dm_123',
        peer: { username: 'alice', profileImage: null },
        lastMessage: 'hello',
        lastMessageAt: '2026-01-01T10:00:00.000Z',
      },
    ]
    inboxMock.unreadCounts = { dm_123: 2 }
    presenceMock.online = [{ username: 'alice', profileImage: null }]

    /**
     * Выполняет метод `render`.
     * @returns Результат выполнения `render`.
     */

    const { container } = render(<DirectChatsPage user={user} onNavigate={onNavigate} />)

    const button = screen.getByRole('button', { name: /alice/i })
    fireEvent.click(button)

    /**
     * Выполняет метод `expect`.
     * @param onNavigate Входной параметр `onNavigate`.
     * @returns Результат выполнения `expect`.
     */

    expect(onNavigate).toHaveBeenCalledWith('/direct/@alice')
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(screen.getByText('2')).toBeInTheDocument()
    expect(container.querySelector('.direct-chat-item .avatar.is-online')).not.toBeNull()
  })

  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('does not show online badge for offline peer', () => {
    inboxMock.items = [
      {
        slug: 'dm_321',
        peer: { username: 'bob', profileImage: null },
        lastMessage: 'offline',
        lastMessageAt: '2026-01-01T10:00:00.000Z',
      },
    ]
    presenceMock.online = []

    const { container } = render(<DirectChatsPage user={user} onNavigate={vi.fn()} />)

    expect(container.querySelector('.direct-chat-item .avatar.is-online')).toBeNull()
  })
})
