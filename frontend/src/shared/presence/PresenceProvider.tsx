import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import type { UserProfile } from '../../entities/user/types'
import type { OnlineUser } from '../api/users'
import { debugLog } from '../lib/debug'
import { getWebSocketBase } from '../lib/ws'
import { useReconnectingWebSocket } from '../../hooks/useReconnectingWebSocket'
import { PresenceContext } from './context'

const PRESENCE_PING_MS = 10000

type ProviderProps = {
  user: UserProfile | null
  ready?: boolean
  children: ReactNode
}

/**
 * Рендерит компонент `PresenceProvider` и связанную разметку.
 * @param props Входной параметр `props`.
 * @returns Результат выполнения `PresenceProvider`.
 */

export function PresenceProvider({ user, children, ready = true }: ProviderProps) {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([])
  const [guestCount, setGuestCount] = useState(0)
  const presenceUrl = useMemo(() => {
    if (!ready) return null
    const base = `${getWebSocketBase()}/ws/presence/`
    return `${base}?auth=${user ? '1' : '0'}`
  }, [user, ready])

  const handlePresence = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data)
      if (Array.isArray(data?.online)) {
        const incoming = data.online
        if (user) {
          const nextImage = user.profileImage || null
          /**
           * Выполняет метод `setOnlineUsers`.
           * @returns Результат выполнения `setOnlineUsers`.
           */

          setOnlineUsers(
            incoming.map((entry: OnlineUser) =>
              entry.username === user.username
                ? { ...entry, profileImage: nextImage }
                : entry,
            ),
          )
        } else {
          /**
           * Выполняет метод `setOnlineUsers`.
           * @param incoming Входной параметр `incoming`.
           * @returns Результат выполнения `setOnlineUsers`.
           */

          setOnlineUsers(incoming)
        }
      }
      const rawGuests = data?.guests
      const parsedGuests =
        typeof rawGuests === 'number' ? rawGuests : Number.isFinite(Number(rawGuests)) ? Number(rawGuests) : null
      if (parsedGuests !== null) {
        /**
         * Выполняет метод `setGuestCount`.
         * @param parsedGuests Входной параметр `parsedGuests`.
         * @returns Результат выполнения `setGuestCount`.
         */

        setGuestCount(parsedGuests)
      }
    } catch (err) {
      /**
       * Выполняет метод `debugLog`.
       * @param err Входной параметр `err`.
       * @returns Результат выполнения `debugLog`.
       */

      debugLog('Presence WS parse failed', err)
    }
  }, [user])


  /**
   * Выполняет метод `useEffect`.
   * @param props Входной параметр `props`.
   * @returns Результат выполнения `useEffect`.
   */

  useEffect(() => {
    if (!ready) {
      /**
       * Выполняет метод `setOnlineUsers`.
       * @param props Входной параметр `props`.
       * @returns Результат выполнения `setOnlineUsers`.
       */

      setOnlineUsers([])
      /**
       * Выполняет метод `setGuestCount`.
       * @returns Результат выполнения `setGuestCount`.
       */

      setGuestCount(0)
    }
  }, [ready])
  /**
   * Выполняет метод `useEffect`.
   * @param props Входной параметр `props`.
   * @returns Результат выполнения `useEffect`.
   */

  useEffect(() => {
    if (!user) return
    /**
     * Выполняет метод `setOnlineUsers`.
     * @returns Результат выполнения `setOnlineUsers`.
     */

    setOnlineUsers((prev) => {
      let changed = false
      const updated = prev.map((entry) => {
        if (entry.username !== user.username) return entry
        const nextImage = user.profileImage || null
        if (entry.profileImage === nextImage) return entry
        changed = true
        return { ...entry, profileImage: nextImage }
      })
      return changed ? updated : prev
    })
  }, [user])

  const { status, lastError, send } = useReconnectingWebSocket({
    url: presenceUrl,
    onMessage: handlePresence,
    onError: (err) => debugLog('Presence WS error', err),
  })

  /**
   * Выполняет метод `useEffect`.
   * @param props Входной параметр `props`.
   * @returns Результат выполнения `useEffect`.
   */

  useEffect(() => {
    if (status !== 'online') return
    const sendPing = () => {
      /**
       * Выполняет метод `send`.
       * @returns Результат выполнения `send`.
       */

      send(JSON.stringify({ type: 'ping', ts: Date.now() }))
    }
    /**
     * Выполняет метод `sendPing`.
     * @returns Результат выполнения `sendPing`.
     */

    sendPing()
    const id = window.setInterval(sendPing, PRESENCE_PING_MS)
    return () => window.clearInterval(id)
  }, [send, status])

  const value = useMemo(
    () => ({
      online: user ? onlineUsers : [],
      guests: guestCount,
      status,
      lastError,
    }),
    [onlineUsers, guestCount, status, lastError, user],
  )

  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>
}
