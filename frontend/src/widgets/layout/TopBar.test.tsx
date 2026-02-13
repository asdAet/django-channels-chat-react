import { fireEvent, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const directInboxMock = vi.hoisted(() => ({
  unreadDialogsCount: 0,
  unreadCounts: {} as Record<string, number>,
}))

const presenceMock = vi.hoisted(() => ({
  online: [] as Array<{ username: string; profileImage: string | null }>,
  guests: 0,
  status: 'online' as const,
  lastError: null as string | null,
}))

vi.mock('../../shared/directInbox', () => ({
  useDirectInbox: () => directInboxMock,
}))

vi.mock('../../shared/presence', () => ({
  usePresence: () => presenceMock,
}))

import { TopBar } from './TopBar'

const user = {
  username: 'demo',
  email: 'demo@example.com',
  profileImage: null,
  bio: '',
  lastSeen: null,
  registeredAt: null,
}

describe('TopBar', () => {
  /**
   * Выполняет метод `beforeEach`.
   * @returns Результат выполнения `beforeEach`.
   */

  beforeEach(() => {
    directInboxMock.unreadDialogsCount = 0
    presenceMock.online = []
    presenceMock.status = 'online'
    presenceMock.lastError = null
  })

  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('does not show direct chats button for guests', () => {
    const { container } = render(<TopBar user={null} onNavigate={vi.fn()} onLogout={vi.fn()} />)
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(container.querySelector('.link-with-badge')).toBeNull()
  })

  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('shows unread badge only for authenticated users', () => {
    directInboxMock.unreadDialogsCount = 2
    presenceMock.online = [{ username: 'demo', profileImage: null }]
    const { container } = render(<TopBar user={user} onNavigate={vi.fn()} onLogout={vi.fn()} />)

    const link = container.querySelector('.link-with-badge')
    /**
     * Выполняет метод `expect`.
     * @param link Входной параметр `link`.
     * @returns Результат выполнения `expect`.
     */

    expect(link).not.toBeNull()

    const badge = container.querySelector('.link-with-badge .badge')
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(badge?.textContent).toBe('2')
    expect(container.querySelector('.topbar .avatar.is-online')).not.toBeNull()
  })

  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('navigates to direct inbox when personal chats clicked', () => {
    const onNavigate = vi.fn()
    const { container } = render(<TopBar user={user} onNavigate={onNavigate} onLogout={vi.fn()} />)

    const directButton = container.querySelector('.link-with-badge')
    /**
     * Выполняет метод `expect`.
     * @param directButton Входной параметр `directButton`.
     * @returns Результат выполнения `expect`.
     */

    expect(directButton).not.toBeNull()
    fireEvent.click(directButton as Element)
    /**
     * Выполняет метод `expect`.
     * @param onNavigate Входной параметр `onNavigate`.
     * @returns Результат выполнения `expect`.
     */

    expect(onNavigate).toHaveBeenCalledWith('/direct')
  })
})
