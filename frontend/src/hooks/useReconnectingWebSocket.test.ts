import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useReconnectingWebSocket } from './useReconnectingWebSocket'

/**
 * Описывает назначение класса `MockWebSocket`.
 */

class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3
  static instances: MockWebSocket[] = []

  public readyState = MockWebSocket.CONNECTING
  public onopen: ((event: Event) => void) | null = null
  public onclose: ((event: CloseEvent) => void) | null = null
  public onerror: ((event: Event) => void) | null = null
  public onmessage: ((event: MessageEvent) => void) | null = null
  public sent: string[] = []

  public readonly url: string
  public readonly protocols?: string | string[]

  constructor(url: string, protocols?: string | string[]) {
    this.url = url
    this.protocols = protocols
    MockWebSocket.instances.push(this)
  }

  /**
   * Выполняет метод `send`.
   * @param data Входной параметр `data`.
   * @returns Результат выполнения `send`.
   */

  send(data: string) {
    this.sent.push(data)
  }

  /**
   * Выполняет метод `close`.
   * @returns Результат выполнения `close`.
   */

  close() {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.({ code: 1000 } as CloseEvent)
  }

  /**
   * Выполняет метод `triggerOpen`.
   * @returns Результат выполнения `triggerOpen`.
   */

  triggerOpen() {
    this.readyState = MockWebSocket.OPEN
    this.onopen?.(new Event('open'))
  }

  /**
   * Выполняет метод `triggerMessage`.
   * @param data Входной параметр `data`.
   * @returns Результат выполнения `triggerMessage`.
   */

  triggerMessage(data: unknown) {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(data) }))
  }

  /**
   * Выполняет метод `triggerError`.
   * @returns Результат выполнения `triggerError`.
   */

  triggerError() {
    this.onerror?.(new Event('error'))
  }

  /**
   * Выполняет метод `triggerClose`.
   * @param code Входной параметр `code`.
   * @returns Результат выполнения `triggerClose`.
   */

  triggerClose(code = 1006) {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.({ code } as CloseEvent)
  }
}

describe('useReconnectingWebSocket', () => {
  /**
   * Выполняет метод `beforeEach`.
   * @returns Результат выполнения `beforeEach`.
   */

  beforeEach(() => {
    vi.useRealTimers()
    MockWebSocket.instances = []
    vi.stubGlobal('WebSocket', MockWebSocket as unknown as typeof WebSocket)
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: true,
    })
  })

  /**
   * Выполняет метод `afterEach`.
   * @returns Результат выполнения `afterEach`.
   */

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('connects and allows send when socket is open', async () => {
    const { result } = renderHook(() =>
      /**
       * Выполняет метод `useReconnectingWebSocket`.
       * @param props Входной параметр `props`.
       * @returns Результат выполнения `useReconnectingWebSocket`.
       */

      useReconnectingWebSocket({
        url: 'ws://localhost/ws',
      }),
    )

    await waitFor(() => expect(MockWebSocket.instances).toHaveLength(1))

    /**
     * Выполняет метод `act`.
     * @returns Результат выполнения `act`.
     */

    act(() => {
      MockWebSocket.instances[0].triggerOpen()
    })

    await waitFor(() => expect(result.current.status).toBe('online'))

    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(result.current.send('ping')).toBe(true)
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(MockWebSocket.instances[0].sent).toEqual(['ping'])
  })

  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('reconnects after unexpected close with backoff', async () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const { result } = renderHook(() =>
      /**
       * Выполняет метод `useReconnectingWebSocket`.
       * @param props Входной параметр `props`.
       * @returns Результат выполнения `useReconnectingWebSocket`.
       */

      useReconnectingWebSocket({
        url: 'ws://localhost/ws',
        maxRetries: 2,
        baseDelayMs: 10,
        maxDelayMs: 20,
      }),
    )

    await act(async () => {
      await Promise.resolve()
    })
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(MockWebSocket.instances).toHaveLength(1)

    /**
     * Выполняет метод `act`.
     * @returns Результат выполнения `act`.
     */

    act(() => {
      MockWebSocket.instances[0].triggerOpen()
      MockWebSocket.instances[0].triggerClose(1011)
    })

    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(result.current.status).toBe('closed')

    /**
     * Выполняет метод `act`.
     * @returns Результат выполнения `act`.
     */

    act(() => {
      vi.advanceTimersByTime(15)
    })

    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(MockWebSocket.instances).toHaveLength(2)
  })

  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('goes offline immediately when browser is offline', async () => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: false,
    })

    const { result } = renderHook(() =>
      /**
       * Выполняет метод `useReconnectingWebSocket`.
       * @param props Входной параметр `props`.
       * @returns Результат выполнения `useReconnectingWebSocket`.
       */

      useReconnectingWebSocket({
        url: 'ws://localhost/ws',
      }),
    )

    await waitFor(() => expect(result.current.status).toBe('offline'))
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(MockWebSocket.instances).toHaveLength(0)
  })


  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('marks error when retry limit is reached', async () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const { result } = renderHook(() =>
      /**
       * Выполняет метод `useReconnectingWebSocket`.
       * @param props Входной параметр `props`.
       * @returns Результат выполнения `useReconnectingWebSocket`.
       */

      useReconnectingWebSocket({
        url: 'ws://localhost/ws',
        maxRetries: 0,
        baseDelayMs: 10,
      }),
    )

    await act(async () => {
      await Promise.resolve()
    })

    /**
     * Выполняет метод `act`.
     * @returns Результат выполнения `act`.
     */

    act(() => {
      MockWebSocket.instances[0].triggerClose(1011)
    })

    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(result.current.status).toBe('error')
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(result.current.lastError).toBe('reconnect_limit')
  })

  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('exposes connection error and send=false when not open', async () => {
    const onError = vi.fn()
    const { result } = renderHook(() =>
      /**
       * Выполняет метод `useReconnectingWebSocket`.
       * @param props Входной параметр `props`.
       * @returns Результат выполнения `useReconnectingWebSocket`.
       */

      useReconnectingWebSocket({
        url: 'ws://localhost/ws',
        onError,
      }),
    )

    await waitFor(() => expect(MockWebSocket.instances).toHaveLength(1))

    /**
     * Выполняет метод `act`.
     * @returns Результат выполнения `act`.
     */

    act(() => {
      MockWebSocket.instances[0].triggerError()
    })

    /**
     * Выполняет метод `expect`.
     * @param onError Входной параметр `onError`.
     * @returns Результат выполнения `expect`.
     */

    expect(onError).toHaveBeenCalledTimes(1)
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(result.current.status).toBe('error')
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(result.current.lastError).toBe('connection_error')
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(result.current.send('x')).toBe(false)
  })

  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('calls onMessage callback', async () => {
    const onMessage = vi.fn()

    /**
     * Выполняет метод `renderHook`.
     * @returns Результат выполнения `renderHook`.
     */

    renderHook(() =>
      /**
       * Выполняет метод `useReconnectingWebSocket`.
       * @param props Входной параметр `props`.
       * @returns Результат выполнения `useReconnectingWebSocket`.
       */

      useReconnectingWebSocket({
        url: 'ws://localhost/ws',
        onMessage,
      }),
    )

    await waitFor(() => expect(MockWebSocket.instances).toHaveLength(1))

    /**
     * Выполняет метод `act`.
     * @returns Результат выполнения `act`.
     */

    act(() => {
      MockWebSocket.instances[0].triggerOpen()
      MockWebSocket.instances[0].triggerMessage({ type: 'event' })
    })

    /**
     * Выполняет метод `expect`.
     * @param onMessage Входной параметр `onMessage`.
     * @returns Результат выполнения `expect`.
     */

    expect(onMessage).toHaveBeenCalledTimes(1)
  })
})
