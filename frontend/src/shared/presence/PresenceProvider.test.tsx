import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const wsMock = vi.hoisted(() => ({
  status: 'online' as const,
  lastError: null as string | null,
  send: vi.fn<(payload: string) => boolean>(),
  options: null as
    | {
        url: string | null
        onMessage?: (event: MessageEvent) => void
      }
    | null,
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

import { usePresence } from './usePresence'
import { PresenceProvider } from './PresenceProvider'

/**
 * Рендерит компонент `PresenceProbe` и связанную разметку.
 * @returns Результат выполнения `PresenceProbe`.
 */

function PresenceProbe() {
  const presence = usePresence()
  return (
    <div>
      <p data-testid="online-count">{presence.online.length}</p>
      <p data-testid="guest-count">{presence.guests}</p>
      <p data-testid="status">{presence.status}</p>
      <p data-testid="online-json">{JSON.stringify(presence.online)}</p>
    </div>
  )
}

const user = {
  username: 'demo',
  email: 'demo@example.com',
  profileImage: 'https://cdn.example.com/demo.jpg',
  bio: '',
  lastSeen: null,
  registeredAt: null,
}

describe('PresenceProvider', () => {
  /**
   * Выполняет метод `beforeEach`.
   * @returns Результат выполнения `beforeEach`.
   */

  beforeEach(() => {
    vi.useRealTimers()
    wsMock.status = 'online'
    wsMock.lastError = null
    wsMock.options = null
    wsMock.send.mockReset().mockReturnValue(true)
  })

  /**
   * Выполняет метод `afterEach`.
   * @returns Результат выполнения `afterEach`.
   */

  afterEach(() => {
    vi.useRealTimers()
  })

  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('applies online list and guests payload for authenticated user', () => {
    /**
     * Выполняет метод `render`.
     * @returns Результат выполнения `render`.
     */

    render(
      <PresenceProvider user={user}>
        <PresenceProbe />
      </PresenceProvider>,
    )

    /**
     * Выполняет метод `act`.
     * @returns Результат выполнения `act`.
     */

    act(() => {
      wsMock.options?.onMessage?.(
        new MessageEvent('message', {
          data: JSON.stringify({
            online: [
              { username: 'demo', profileImage: null },
              { username: 'alice', profileImage: null },
            ],
            guests: 3,
          }),
        }),
      )
    })

    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(screen.getByTestId('online-count').textContent).toBe('2')
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(screen.getByTestId('guest-count').textContent).toBe('3')
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(screen.getByTestId('online-json').textContent).toContain('https://cdn.example.com/demo.jpg')
  })

  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('hides online list for guests but keeps guest counter', () => {
    /**
     * Выполняет метод `render`.
     * @returns Результат выполнения `render`.
     */

    render(
      <PresenceProvider user={null}>
        <PresenceProbe />
      </PresenceProvider>,
    )

    /**
     * Выполняет метод `act`.
     * @returns Результат выполнения `act`.
     */

    act(() => {
      wsMock.options?.onMessage?.(
        new MessageEvent('message', {
          data: JSON.stringify({
            online: [{ username: 'alice', profileImage: null }],
            guests: 2,
          }),
        }),
      )
    })

    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(screen.getByTestId('online-count').textContent).toBe('0')
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(screen.getByTestId('guest-count').textContent).toBe('2')
  })

  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('does not create websocket url until ready=true', () => {
    /**
     * Выполняет метод `render`.
     * @returns Результат выполнения `render`.
     */

    render(
      <PresenceProvider user={user} ready={false}>
        <PresenceProbe />
      </PresenceProvider>,
    )

    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(wsMock.options?.url).toBeNull()
  })

  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('sends heartbeat ping immediately and by interval while online', () => {
    vi.useFakeTimers()

    /**
     * Выполняет метод `render`.
     * @returns Результат выполнения `render`.
     */

    render(
      <PresenceProvider user={user}>
        <PresenceProbe />
      </PresenceProvider>,
    )

    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(wsMock.send).toHaveBeenCalledTimes(1)

    /**
     * Выполняет метод `act`.
     * @returns Результат выполнения `act`.
     */

    act(() => {
      vi.advanceTimersByTime(20_000)
    })

    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(wsMock.send).toHaveBeenCalledTimes(3)
  })

  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('resets presence state when provider becomes not ready', () => {
    const { rerender } = render(
      <PresenceProvider user={user} ready>
        <PresenceProbe />
      </PresenceProvider>,
    )

    /**
     * Выполняет метод `act`.
     * @returns Результат выполнения `act`.
     */

    act(() => {
      wsMock.options?.onMessage?.(
        new MessageEvent('message', {
          data: JSON.stringify({
            online: [{ username: 'alice', profileImage: null }],
            guests: 5,
          }),
        }),
      )
    })

    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(screen.getByTestId('guest-count').textContent).toBe('5')

    /**
     * Выполняет метод `rerender`.
     * @returns Результат выполнения `rerender`.
     */

    rerender(
      <PresenceProvider user={user} ready={false}>
        <PresenceProbe />
      </PresenceProvider>,
    )

    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(screen.getByTestId('online-count').textContent).toBe('0')
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(screen.getByTestId('guest-count').textContent).toBe('0')
  })
})