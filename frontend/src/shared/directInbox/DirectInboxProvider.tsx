import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { chatController } from '../../controllers/ChatController'
import { decodeDirectInboxWsEvent } from '../../dto'
import type { DirectChatListItem as DirectChatListItemDto } from '../../entities/room/types'
import type { UserProfile } from '../../entities/user/types'
import { useReconnectingWebSocket } from '../../hooks/useReconnectingWebSocket'
import { invalidateDirectChats } from '../cache/cacheManager'
import { debugLog } from '../lib/debug'
import { getWebSocketBase } from '../lib/ws'
import { DirectInboxContext } from './context'

const DIRECT_INBOX_PING_MS = 15_000

type ProviderProps = {
  user: UserProfile | null
  ready?: boolean
  children: ReactNode
}

const mergeItem = (prev: DirectChatListItemDto[], incoming: DirectChatListItemDto) => {
  const filtered = prev.filter((item) => item.slug !== incoming.slug)
  const next = [incoming, ...filtered]

  next.sort((a, b) => {
    const aTs = new Date(a.lastMessageAt).getTime()
    const bTs = new Date(b.lastMessageAt).getTime()
    if (!Number.isFinite(aTs) && !Number.isFinite(bTs)) return 0
    if (!Number.isFinite(aTs)) return 1
    if (!Number.isFinite(bTs)) return -1
    return bTs - aTs
  })

  return next
}

/**
 * Провайдер списка direct-чатов и unread-состояния.
 * @param props Пользователь, флаг готовности и дочерние компоненты.
 * @returns React context provider direct inbox.
 */
export function DirectInboxProvider({ user, ready = true, children }: ProviderProps) {
  const [items, setItems] = useState<DirectChatListItemDto[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unreadSlugs, setUnreadSlugs] = useState<string[]>([])
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})
  const [unreadDialogsCount, setUnreadDialogsCount] = useState(0)

  const activeRoomRef = useRef<string | null>(null)

  const wsUrl = useMemo(() => {
    if (!ready || !user) return null
    return `${getWebSocketBase()}/ws/direct/inbox/`
  }, [ready, user])

  const applyUnreadState = useCallback((next: { dialogs: number; slugs: string[]; counts: Record<string, number> }) => {
    setUnreadSlugs(next.slugs)
    setUnreadCounts(next.counts)
    setUnreadDialogsCount(next.dialogs)
  }, [])

  const refresh = useCallback(async () => {
    if (!user) return

    setLoading(true)
    setError(null)

    try {
      const response = await chatController.getDirectChats()
      setItems(response.items || [])
    } catch (err) {
      debugLog('Direct inbox initial load failed', err)
      setError('Не удалось загрузить список чатов')
    } finally {
      setLoading(false)
    }
  }, [user])

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      const decoded = decodeDirectInboxWsEvent(event.data)

      switch (decoded.type) {
        case 'direct_unread_state':
          applyUnreadState(decoded.unread)
          break
        case 'direct_inbox_item':
          if (decoded.item) {
            const incomingItem = decoded.item
            setItems((prev) => mergeItem(prev, incomingItem))
          }
          invalidateDirectChats()
          if (decoded.unread) {
            applyUnreadState(decoded.unread)
          }
          break
        case 'direct_mark_read_ack':
          applyUnreadState(decoded.unread)
          break
        case 'error':
          if (decoded.code === 'forbidden') {
            setError('Недостаточно прав для этого чата')
          }
          break
        default:
          break
      }
    },
    [applyUnreadState],
  )

  const { status, lastError, send } = useReconnectingWebSocket({
    url: wsUrl,
    onMessage: handleMessage,
    onOpen: () => setError(null),
    onError: (err) => debugLog('Direct inbox WS error', err),
  })

  const setActiveRoom = useCallback(
    (roomSlug: string | null) => {
      activeRoomRef.current = roomSlug
      if (status !== 'online') return
      send(JSON.stringify({ type: 'set_active_room', roomSlug }))
    },
    [send, status],
  )

  const markRead = useCallback(
    (roomSlug: string) => {
      const slug = roomSlug.trim()
      if (!slug) return

      setUnreadSlugs((prev) => {
        if (!prev.includes(slug)) return prev
        const next = prev.filter((item) => item !== slug)
        setUnreadDialogsCount(next.length)
        return next
      })

      setUnreadCounts((prev) => {
        if (!(slug in prev)) return prev
        const next = { ...prev }
        delete next[slug]
        return next
      })

      if (status !== 'online') return
      send(JSON.stringify({ type: 'mark_read', roomSlug: slug }))
    },
    [send, status],
  )

  useEffect(() => {
    let active = true

    if (!ready || !user) {
      queueMicrotask(() => {
        if (!active) return
        setItems([])
        setUnreadSlugs([])
        setUnreadCounts({})
        setUnreadDialogsCount(0)
        setLoading(false)
        setError(null)
      })
      return () => {
        active = false
      }
    }

    void refresh()

    return () => {
      active = false
    }
  }, [ready, user, refresh])

  useEffect(() => {
    if (status !== 'online') return

    send(JSON.stringify({ type: 'ping', ts: Date.now() }))
    send(JSON.stringify({ type: 'set_active_room', roomSlug: activeRoomRef.current }))

    const id = window.setInterval(() => {
      send(JSON.stringify({ type: 'ping', ts: Date.now() }))
    }, DIRECT_INBOX_PING_MS)

    return () => {
      window.clearInterval(id)
    }
  }, [send, status])

  useEffect(() => {
    if (!lastError || status !== 'error') return
    queueMicrotask(() => setError('Проблема с подключением личных чатов'))
  }, [lastError, status])

  const value = useMemo(
    () => ({
      items,
      loading,
      error,
      status,
      unreadSlugs,
      unreadCounts,
      unreadDialogsCount,
      setActiveRoom,
      markRead,
      refresh,
    }),
    [
      error,
      items,
      loading,
      markRead,
      refresh,
      setActiveRoom,
      status,
      unreadDialogsCount,
      unreadSlugs,
      unreadCounts,
    ],
  )

  return <DirectInboxContext.Provider value={value}>{children}</DirectInboxContext.Provider>
}

