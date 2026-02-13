import { useCallback, useEffect, useRef, useState } from 'react'

export type WebSocketStatus = 'idle' | 'connecting' | 'online' | 'offline' | 'error' | 'closed'

type WebSocketOptions = {
  url: string | null
  protocols?: string | string[]
  onMessage?: (event: MessageEvent) => void
  onOpen?: () => void
  onClose?: (event: CloseEvent) => void
  onError?: (event: Event) => void
  maxRetries?: number
  baseDelayMs?: number
  maxDelayMs?: number
}

/**
 * Управляет состоянием и эффектами хука `useReconnectingWebSocket`.
 * @param options Входной параметр `options`.
 * @returns Результат выполнения `useReconnectingWebSocket`.
 */

export const useReconnectingWebSocket = (options: WebSocketOptions) => {
  const {
    url,
    protocols,
    onMessage,
    onOpen,
    onClose,
    onError,
    maxRetries = 8,
    baseDelayMs = 600,
    maxDelayMs = 10_000,
  } = options

  const [status, setStatus] = useState<WebSocketStatus>('idle')
  const [lastError, setLastError] = useState<string | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const retryRef = useRef<{ attempt: number; timeoutId: number | null }>({
    attempt: 0,
    timeoutId: null,
  })
  const connectRef = useRef<(() => void) | null>(null)
  const handlersRef = useRef({ onMessage, onOpen, onClose, onError })
  const activeRef = useRef(true)

  /**
   * Выполняет метод `useEffect`.
   * @param props Входной параметр `props`.
   * @returns Результат выполнения `useEffect`.
   */

  useEffect(() => {
    handlersRef.current = { onMessage, onOpen, onClose, onError }
  }, [onMessage, onOpen, onClose, onError])

  const clearRetry = () => {
    if (retryRef.current.timeoutId) {
      window.clearTimeout(retryRef.current.timeoutId)
      retryRef.current.timeoutId = null
    }
  }

  const cleanup = useCallback(() => {
    /**
     * Выполняет метод `clearRetry`.
     * @returns Результат выполнения `clearRetry`.
     */

    clearRetry()
    if (socketRef.current) {
      socketRef.current.onopen = null
      socketRef.current.onclose = null
      socketRef.current.onerror = null
      socketRef.current.onmessage = null
      socketRef.current.close()
      socketRef.current = null
    }
  }, [])

  const connect = useCallback(() => {
    if (!url) {
      /**
       * Выполняет метод `cleanup`.
       * @returns Результат выполнения `cleanup`.
       */

      cleanup()
      /**
       * Выполняет метод `setStatus`.
       * @returns Результат выполнения `setStatus`.
       */

      setStatus('idle')
      return
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      /**
       * Выполняет метод `cleanup`.
       * @returns Результат выполнения `cleanup`.
       */

      cleanup()
      /**
       * Выполняет метод `setStatus`.
       * @returns Результат выполнения `setStatus`.
       */

      setStatus('offline')
      return
    }

    /**
     * Выполняет метод `cleanup`.
     * @returns Результат выполнения `cleanup`.
     */

    cleanup()
    /**
     * Выполняет метод `setStatus`.
     * @returns Результат выполнения `setStatus`.
     */

    setStatus('connecting')

    const socket = new WebSocket(url, protocols)
    socketRef.current = socket

    socket.onopen = () => {
      retryRef.current.attempt = 0
      /**
       * Выполняет метод `setStatus`.
       * @returns Результат выполнения `setStatus`.
       */

      setStatus('online')
      /**
       * Выполняет метод `setLastError`.
       * @param null Входной параметр `null`.
       * @returns Результат выполнения `setLastError`.
       */

      setLastError(null)
      handlersRef.current.onOpen?.()
    }

    socket.onmessage = (event) => {
      handlersRef.current.onMessage?.(event)
    }

    socket.onerror = (event) => {
      /**
       * Выполняет метод `setStatus`.
       * @returns Результат выполнения `setStatus`.
       */

      setStatus('error')
      /**
       * Выполняет метод `setLastError`.
       * @returns Результат выполнения `setLastError`.
       */

      setLastError('connection_error')
      handlersRef.current.onError?.(event)
    }

    socket.onclose = (event) => {
      handlersRef.current.onClose?.(event)
      if (!activeRef.current) return

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        /**
         * Выполняет метод `setStatus`.
         * @returns Результат выполнения `setStatus`.
         */

        setStatus('offline')
        return
      }

      /**
       * Выполняет метод `setStatus`.
       * @returns Результат выполнения `setStatus`.
       */

      setStatus('closed')

      if (retryRef.current.attempt >= maxRetries) {
        /**
         * Выполняет метод `setStatus`.
         * @returns Результат выполнения `setStatus`.
         */

        setStatus('error')
        /**
         * Выполняет метод `setLastError`.
         * @returns Результат выполнения `setLastError`.
         */

        setLastError('reconnect_limit')
        return
      }

      const attempt = retryRef.current.attempt
      retryRef.current.attempt += 1
      const jitter = Math.floor(Math.random() * 200)
      const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt) + jitter
      retryRef.current.timeoutId = window.setTimeout(() => {
        connectRef.current?.()
      }, delay)
    }
  }, [baseDelayMs, cleanup, maxDelayMs, maxRetries, protocols, url])

  /**
   * Выполняет метод `useEffect`.
   * @param props Входной параметр `props`.
   * @returns Результат выполнения `useEffect`.
   */

  useEffect(() => {
    connectRef.current = connect
  }, [connect])

  /**
   * Выполняет метод `useEffect`.
   * @param props Входной параметр `props`.
   * @returns Результат выполнения `useEffect`.
   */

  useEffect(() => {
    activeRef.current = true
    /**
     * Выполняет метод `queueMicrotask`.
     * @returns Результат выполнения `queueMicrotask`.
     */

    queueMicrotask(() => connect())
    return () => {
      activeRef.current = false
      /**
       * Выполняет метод `cleanup`.
       * @returns Результат выполнения `cleanup`.
       */

      cleanup()
    }
  }, [connect, cleanup])

  /**
   * Выполняет метод `useEffect`.
   * @param props Входной параметр `props`.
   * @returns Результат выполнения `useEffect`.
   */

  useEffect(() => {
    const handleOnline = () => {
      /**
       * Выполняет метод `setStatus`.
       * @returns Результат выполнения `setStatus`.
       */

      setStatus('connecting')
      /**
       * Выполняет метод `connect`.
       * @returns Результат выполнения `connect`.
       */

      connect()
    }
    const handleOffline = () => {
      /**
       * Выполняет метод `setStatus`.
       * @returns Результат выполнения `setStatus`.
       */

      setStatus('offline')
      /**
       * Выполняет метод `cleanup`.
       * @returns Результат выполнения `cleanup`.
       */

      cleanup()
    }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [cleanup, connect])

  const send = useCallback((data: string) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(data)
      return true
    }
    return false
  }, [])

  return {
    status,
    lastError,
    send,
    reconnect: connect,
  }
}
