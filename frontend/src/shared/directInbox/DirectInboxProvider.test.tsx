import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const wsMock = vi.hoisted(() => ({
  status: 'online' as 'online' | 'offline' | 'error' | 'connecting' | 'idle' | 'closed',
  lastError: null as string | null,
  send: vi.fn<(payload: string) => boolean>(),
  options: null as
    | {
        url: string | null
        onMessage?: (event: MessageEvent) => void
      }
    | null,
}))

const chatMock = vi.hoisted(() => ({
  getDirectChats: vi.fn<() => Promise<{ items: Array<{ slug: string; peer: { username: string; profileImage: string | null }; lastMessage: string; lastMessageAt: string }> }>>(),
}))

vi.mock('../../controllers/ChatController', () => ({
  chatController: chatMock,
}))

vi.mock('../../hooks/useReconnectingWebSocket', () => ({
  useReconnectingWebSocket: (options: unknown) => {
    wsMock.options = options as { url: string | null; onMessage?: (event: MessageEvent) => void }
    return {
      status: wsMock.status,
      lastError: wsMock.lastError,
      send: wsMock.send,
      reconnect: vi.fn(),
    }
  },
}))

import { DirectInboxProvider } from './DirectInboxProvider'
import { useDirectInbox } from './useDirectInbox'

const user = {
  username: 'demo',
  email: 'demo@example.com',
  profileImage: null,
  bio: '',
  lastSeen: null,
  registeredAt: null,
}

/**
 * Рендерит компонент `Probe` и связанную разметку.
 * @returns Результат выполнения `Probe`.
 */

function Probe() {
  const inbox = useDirectInbox()

  return (
    <div>
      <p data-testid="loading">{String(inbox.loading)}</p>
      <p data-testid="unread-count">{inbox.unreadDialogsCount}</p>
      <p data-testid="unread-counts">{JSON.stringify(inbox.unreadCounts)}</p>
      <p data-testid="items-order">{inbox.items.map((item) => item.slug).join(',')}</p>
      <button onClick={() => inbox.setActiveRoom('dm_1')}>set-active</button>
      <button onClick={() => inbox.markRead('dm_1')}>mark-read</button>
    </div>
  )
}

/**
 * Выполняет функцию `sentPayloads`.
 * @returns Результат выполнения `sentPayloads`.
 */

const sentPayloads = () =>
  wsMock.send.mock.calls.map(([raw]) => {
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  })

describe('DirectInboxProvider', () => {
  /**
   * Выполняет метод `beforeEach`.
   * @returns Результат выполнения `beforeEach`.
   */

  beforeEach(() => {
    wsMock.status = 'online'
    wsMock.lastError = null
    wsMock.send.mockReset().mockReturnValue(true)
    wsMock.options = null
    chatMock.getDirectChats.mockReset().mockResolvedValue({ items: [] })
  })

  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('loads initial chats and applies unread events', async () => {
    chatMock.getDirectChats.mockResolvedValue({
      items: [
        {
          slug: 'dm_1',
          peer: { username: 'alice', profileImage: null },
          lastMessage: 'hello',
          lastMessageAt: '2026-02-13T10:00:00Z',
        },
      ],
    })

    /**
     * Выполняет метод `render`.
     * @returns Результат выполнения `render`.
     */

    render(
      <DirectInboxProvider user={user}>
        <Probe />
      </DirectInboxProvider>,
    )

    await waitFor(() => {
      /**
       * Выполняет метод `expect`.
       * @returns Результат выполнения `expect`.
       */

      expect(screen.getByTestId('items-order').textContent).toBe('dm_1')
    })

    /**
     * Выполняет метод `act`.
     * @returns Результат выполнения `act`.
     */

    act(() => {
      wsMock.options?.onMessage?.(
        new MessageEvent('message', {
          data: JSON.stringify({
            type: 'direct_unread_state',
            unread: { dialogs: 1, slugs: ['dm_1'], counts: { dm_1: 2 } },
          }),
        }),
      )
    })

    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(screen.getByTestId('unread-count').textContent).toBe('1')
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(screen.getByTestId('unread-counts').textContent).toBe('{"dm_1":2}')

    /**
     * Выполняет метод `act`.
     * @returns Результат выполнения `act`.
     */

    act(() => {
      wsMock.options?.onMessage?.(
        new MessageEvent('message', {
          data: JSON.stringify({
            type: 'direct_mark_read_ack',
            roomSlug: 'dm_1',
            unread: { dialogs: 0, slugs: [], counts: {} },
          }),
        }),
      )
    })

    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(screen.getByTestId('unread-count').textContent).toBe('0')
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(screen.getByTestId('unread-counts').textContent).toBe('{}')
  })

  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('reorders chats when realtime item arrives', async () => {
    chatMock.getDirectChats.mockResolvedValue({
      items: [
        {
          slug: 'dm_old',
          peer: { username: 'alice', profileImage: null },
          lastMessage: 'old',
          lastMessageAt: '2026-02-13T10:00:00Z',
        },
        {
          slug: 'dm_new',
          peer: { username: 'bob', profileImage: null },
          lastMessage: 'new',
          lastMessageAt: '2026-02-13T11:00:00Z',
        },
      ],
    })

    /**
     * Выполняет метод `render`.
     * @returns Результат выполнения `render`.
     */

    render(
      <DirectInboxProvider user={user}>
        <Probe />
      </DirectInboxProvider>,
    )

    await waitFor(() => {
      /**
       * Выполняет метод `expect`.
       * @returns Результат выполнения `expect`.
       */

      expect(screen.getByTestId('items-order').textContent).toBe('dm_old,dm_new')
    })

    /**
     * Выполняет метод `act`.
     * @returns Результат выполнения `act`.
     */

    act(() => {
      wsMock.options?.onMessage?.(
        new MessageEvent('message', {
          data: JSON.stringify({
            type: 'direct_inbox_item',
            item: {
              slug: 'dm_old',
              peer: { username: 'alice', profileImage: null },
              lastMessage: 'latest',
              lastMessageAt: '2026-02-13T12:00:00Z',
            },
            unread: { dialogs: 1, slugs: ['dm_old'], counts: { dm_old: 3 } },
          }),
        }),
      )
    })

    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(screen.getByTestId('items-order').textContent).toBe('dm_old,dm_new')
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(screen.getByTestId('unread-count').textContent).toBe('1')
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(screen.getByTestId('unread-counts').textContent).toBe('{"dm_old":3}')
  })

  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('sends mark_read and set_active_room commands', async () => {
    /**
     * Выполняет метод `render`.
     * @returns Результат выполнения `render`.
     */

    render(
      <DirectInboxProvider user={user}>
        <Probe />
      </DirectInboxProvider>,
    )

    await waitFor(() => {
      /**
       * Выполняет метод `expect`.
       * @returns Результат выполнения `expect`.
       */

      expect(chatMock.getDirectChats).toHaveBeenCalledTimes(1)
    })

    /**
     * Выполняет метод `act`.
     * @returns Результат выполнения `act`.
     */

    act(() => {
      wsMock.options?.onMessage?.(
        new MessageEvent('message', {
          data: JSON.stringify({
            type: 'direct_unread_state',
            unread: { dialogs: 1, slugs: ['dm_1'], counts: { dm_1: 1 } },
          }),
        }),
      )
    })

    fireEvent.click(screen.getByRole('button', { name: 'mark-read' }))
    fireEvent.click(screen.getByRole('button', { name: 'set-active' }))

    const payloads = sentPayloads()
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(payloads.some((payload) => payload?.type === 'mark_read' && payload?.roomSlug === 'dm_1')).toBe(true)
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(payloads.some((payload) => payload?.type === 'set_active_room' && payload?.roomSlug === 'dm_1')).toBe(true)
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(screen.getByTestId('unread-count').textContent).toBe('0')
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(screen.getByTestId('unread-counts').textContent).toBe('{}')
  })

  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('re-sends active room after reconnect', async () => {
    wsMock.status = 'offline'

    const { rerender } = render(
      <DirectInboxProvider user={user}>
        <Probe />
      </DirectInboxProvider>,
    )

    await waitFor(() => {
      /**
       * Выполняет метод `expect`.
       * @returns Результат выполнения `expect`.
       */

      expect(chatMock.getDirectChats).toHaveBeenCalledTimes(1)
    })

    fireEvent.click(screen.getByRole('button', { name: 'set-active' }))
    wsMock.send.mockClear()

    wsMock.status = 'online'
    /**
     * Выполняет метод `rerender`.
     * @returns Результат выполнения `rerender`.
     */

    rerender(
      <DirectInboxProvider user={user}>
        <Probe />
      </DirectInboxProvider>,
    )

    const payloads = sentPayloads()
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(payloads.some((payload) => payload?.type === 'ping')).toBe(true)
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(payloads.some((payload) => payload?.type === 'set_active_room' && payload?.roomSlug === 'dm_1')).toBe(true)
  })
})
