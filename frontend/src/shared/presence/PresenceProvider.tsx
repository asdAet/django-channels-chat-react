import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { apiService } from '../../adapters/ApiService'
import { decodePresenceWsEvent } from '../../dto'
import type { UserProfile } from '../../entities/user/types'
import { useReconnectingWebSocket } from '../../hooks/useReconnectingWebSocket'
import type { OnlineUser } from '../api/users'
import { debugLog } from '../lib/debug'
import { getWebSocketBase } from '../lib/ws'
import { PresenceContext } from './context'

const PRESENCE_PING_MS = 10000

type ProviderProps = {
  user: UserProfile | null
  ready?: boolean
  children: ReactNode
}

/**
 * Провайдер presence-состояния (онлайн-пользователи и гости).
 * @param props Пользователь, флаг готовности и дочерние компоненты.
 * @returns React context provider presence.
 */
export function PresenceProvider({ user, children, ready = true }: ProviderProps) {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([])
  const [guestCount, setGuestCount] = useState(0)
  const [guestSessionReady, setGuestSessionReady] = useState(false)
  const needsGuestSessionBootstrap = ready && !user && !guestSessionReady

  useEffect(() => {
    if (!needsGuestSessionBootstrap) return

    let active = true
    apiService
      .ensurePresenceSession()
      .then(() => {
        if (!active) return
        setGuestSessionReady(true)
      })
      .catch((err) => {
        debugLog('Presence guest bootstrap failed', err)
        if (!active) return
        setGuestSessionReady(false)
      })

    return () => {
      active = false
    }
  }, [needsGuestSessionBootstrap])

  const presenceUrl = useMemo(() => {
    if (!ready) return null
    if (!user && !guestSessionReady) return null
    const base = `${getWebSocketBase()}/ws/presence/`
    return `${base}?auth=${user ? '1' : '0'}`
  }, [guestSessionReady, ready, user])

  const handlePresence = useCallback(
    (event: MessageEvent) => {
      const decoded = decodePresenceWsEvent(event.data)
      if (decoded.type !== 'state') {
        return
      }

      if (decoded.online) {
        if (user) {
          const nextImage = user.profileImage || null
          setOnlineUsers(
            decoded.online.map((entry) =>
              entry.username === user.username ? { ...entry, profileImage: nextImage } : entry,
            ),
          )
        } else {
          setOnlineUsers(decoded.online)
        }
      }

      if (decoded.guests !== null) {
        setGuestCount(decoded.guests)
      }
    },
    [user],
  )

  const { status, lastError, send } = useReconnectingWebSocket({
    url: presenceUrl,
    onMessage: handlePresence,
    onError: (err) => debugLog('Presence WS error', err),
  })

  useEffect(() => {
    if (status !== 'online') return

    const sendPing = () => {
      send(JSON.stringify({ type: 'ping', ts: Date.now() }))
    }

    sendPing()
    const id = window.setInterval(sendPing, PRESENCE_PING_MS)
    return () => window.clearInterval(id)
  }, [send, status])

  const visibleOnline = useMemo(() => {
    if (!user) return []

    const nextImage = user.profileImage || null
    return onlineUsers.map((entry) =>
      entry.username === user.username ? { ...entry, profileImage: nextImage } : entry,
    )
  }, [onlineUsers, user])

  const value = useMemo(
    () => ({
      online: ready ? visibleOnline : [],
      guests: ready ? guestCount : 0,
      status,
      lastError,
    }),
    [visibleOnline, guestCount, ready, status, lastError],
  )

  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>
}

