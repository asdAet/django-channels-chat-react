import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const publicRoomMock = vi.hoisted(() => ({
  room: { slug: 'public', name: 'Public', kind: 'public', created: false, createdBy: null },
  loading: false,
}))

const chatActionsMock = vi.hoisted(() => ({
  getRoomDetails: vi.fn(),
  getRoomMessages: vi.fn(),
}))

const presenceMock = vi.hoisted(() => ({
  online: [] as Array<{ username: string; profileImage: string | null }>,
  guests: 0,
  status: 'online',
  lastError: null as string | null,
}))

vi.mock('../hooks/usePublicRoom', () => ({
  usePublicRoom: () => ({ publicRoom: publicRoomMock.room, loading: publicRoomMock.loading }),
}))

vi.mock('../hooks/useChatActions', () => ({
  useChatActions: () => chatActionsMock,
}))

vi.mock('../hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => true,
}))

vi.mock('../hooks/useReconnectingWebSocket', () => ({
  useReconnectingWebSocket: () => ({
    status: 'online',
    lastError: null,
    send: vi.fn(),
    reconnect: vi.fn(),
  }),
}))

vi.mock('../shared/presence', () => ({
  usePresence: () => presenceMock,
}))

import { HomePage } from './HomePage'

const user = {
  username: 'demo',
  email: 'demo@example.com',
  profileImage: null,
  bio: '',
  lastSeen: null,
  registeredAt: null,
}

describe('HomePage', () => {
  /**
   * Выполняет метод `beforeEach`.
   * @returns Результат выполнения `beforeEach`.
   */

  beforeEach(() => {
    publicRoomMock.room = { slug: 'public', name: 'Public', kind: 'public', created: false, createdBy: null }
    publicRoomMock.loading = false

    chatActionsMock.getRoomDetails.mockReset()
    chatActionsMock.getRoomMessages.mockReset().mockResolvedValue({
      messages: [],
      pagination: { limit: 4, hasMore: false, nextBefore: null },
    })

    presenceMock.online = []
    presenceMock.guests = 0
    presenceMock.status = 'online'
    presenceMock.lastError = null
  })

  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('shows guest info prompt for unauthenticated user', async () => {
    /**
     * Выполняет метод `render`.
     * @returns Результат выполнения `render`.
     */

    render(<HomePage user={null} onNavigate={vi.fn()} />)

    await waitFor(() =>
      /**
       * Выполняет метод `expect`.
       * @returns Результат выполнения `expect`.
       */

      expect(screen.getByText('Войдите, чтобы видеть участников онлайн.')).toBeInTheDocument(),
    )
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(screen.getByText('Гостей онлайн')).toBeInTheDocument()
  })

  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('shows presence loading for authenticated user while ws connecting', async () => {
    presenceMock.status = 'connecting'

    /**
     * Выполняет метод `render`.
     * @returns Результат выполнения `render`.
     */

    render(<HomePage user={user} onNavigate={vi.fn()} />)

    await waitFor(() =>
      /**
       * Выполняет метод `expect`.
       * @returns Результат выполнения `expect`.
       */

      expect(screen.getByText('Загружаем список онлайн...')).toBeInTheDocument(),
    )
  })

  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('opens user profile from online list', async () => {
    const onNavigate = vi.fn()
    presenceMock.online = [{ username: 'alice', profileImage: null }]

    /**
     * Выполняет метод `render`.
     * @returns Результат выполнения `render`.
     */

    const { container } = render(<HomePage user={user} onNavigate={onNavigate} />)

    const button = await screen.findByRole('button', {
      name: 'Открыть профиль пользователя alice',
    })
    fireEvent.click(button)

    /**
     * Выполняет метод `expect`.
     * @param onNavigate Входной параметр `onNavigate`.
     * @returns Результат выполнения `expect`.
     */

    expect(onNavigate).toHaveBeenCalledWith('/users/alice')
    expect(container.querySelector('.online-item .avatar.is-online')).not.toBeNull()
  })
})
