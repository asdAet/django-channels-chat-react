import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { chatController } from '../../controllers/ChatController'
import type { DirectChatListItemDto } from '../../dto/chat'
import type { UserProfile } from '../../entities/user/types'
import { useReconnectingWebSocket } from '../../hooks/useReconnectingWebSocket'
import { debugLog } from '../lib/debug'
import { getWebSocketBase } from '../lib/ws'
import { invalidateDirectChats } from '../cache/cacheManager'
import { DirectInboxContext } from './context'

const DIRECT_INBOX_PING_MS = 15_000

type ProviderProps = {
  user: UserProfile | null
  ready?: boolean
  children: ReactNode
}

type InboxUnreadPayload = {
  dialogs?: number
  slugs?: string[]
  counts?: Record<string, number>
}

type InboxItemPayload = {
  slug?: string
  peer?: {
    username?: string
    profileImage?: string | null
  }
  lastMessage?: string
  lastMessageAt?: string
}

/**
 * Выполняет функцию `normalizeUnread`.
 * @param payload Входной параметр `payload`.
 * @returns Результат выполнения `normalizeUnread`.
 */

const normalizeUnread = (payload: unknown): { dialogs: number; slugs: string[]; counts: Record<string, number> } => {
  if (!payload || typeof payload !== 'object') {
    return { dialogs: 0, slugs: [], counts: {} }
  }
  const typed = payload as InboxUnreadPayload
  const normalizedCounts: Record<string, number> = {}
  if (typed.counts && typeof typed.counts === 'object') {
    for (const [key, raw] of Object.entries(typed.counts)) {
      const slug = String(key).trim()
      if (!slug) continue
      const count = Number(raw)
      if (!Number.isFinite(count) || count <= 0) continue
      normalizedCounts[slug] = Math.floor(count)
    }
  }
  let slugs = Array.isArray(typed.slugs)
    ? typed.slugs.filter((slug): slug is string => typeof slug === 'string' && slug.length > 0)
    : []
  if (!Object.keys(normalizedCounts).length && slugs.length) {
    for (const slug of slugs) normalizedCounts[slug] = 1
  }
  if (Object.keys(normalizedCounts).length) {
    slugs = Object.keys(normalizedCounts)
  }
  const dialogs =
    typeof typed.dialogs === 'number'
      ? typed.dialogs
      : Object.keys(normalizedCounts).length || slugs.length
  return { dialogs: Math.max(0, dialogs), slugs, counts: normalizedCounts }
}

/**
 * Выполняет функцию `normalizeItem`.
 * @param payload Входной параметр `payload`.
 * @returns Результат выполнения `normalizeItem`.
 */

const normalizeItem = (payload: unknown): DirectChatListItemDto | null => {
  if (!payload || typeof payload !== 'object') return null
  const typed = payload as InboxItemPayload
  if (!typed.slug || !typed.peer?.username) return null
  return {
    slug: typed.slug,
    peer: {
      username: typed.peer.username,
      profileImage: typed.peer.profileImage ?? null,
    },
    lastMessage: typeof typed.lastMessage === 'string' ? typed.lastMessage : '',
    lastMessageAt: typeof typed.lastMessageAt === 'string' ? typed.lastMessageAt : new Date().toISOString(),
  }
}

/**
 * Выполняет функцию `mergeItem`.
 * @param prev Входной параметр `prev`.
 * @param incoming Входной параметр `incoming`.
 * @returns Результат выполнения `mergeItem`.
 */

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
 * Рендерит компонент `DirectInboxProvider` и связанную разметку.
 * @param props Входной параметр `props`.
 * @returns Результат выполнения `DirectInboxProvider`.
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

  const applyUnreadState = useCallback((payload: unknown) => {
    const next = normalizeUnread(payload)
    /**
     * Выполняет метод `setUnreadSlugs`.
     * @returns Результат выполнения `setUnreadSlugs`.
     */

    setUnreadSlugs(next.slugs)
    /**
     * Выполняет метод `setUnreadCounts`.
     * @returns Результат выполнения `setUnreadCounts`.
     */

    setUnreadCounts(next.counts)
    /**
     * Выполняет метод `setUnreadDialogsCount`.
     * @returns Результат выполнения `setUnreadDialogsCount`.
     */

    setUnreadDialogsCount(next.dialogs)
  }, [])

  const refresh = useCallback(async () => {
    if (!user) return
    /**
     * Выполняет метод `setLoading`.
     * @param true Входной параметр `true`.
     * @returns Результат выполнения `setLoading`.
     */

    setLoading(true)
    /**
     * Выполняет метод `setError`.
     * @param null Входной параметр `null`.
     * @returns Результат выполнения `setError`.
     */

    setError(null)
    try {
      const response = await chatController.getDirectChats()
      /**
       * Выполняет метод `setItems`.
       * @returns Результат выполнения `setItems`.
       */

      setItems(response.items || [])
    } catch (err) {
      /**
       * Выполняет метод `debugLog`.
       * @param err Входной параметр `err`.
       * @returns Результат выполнения `debugLog`.
       */

      debugLog('Direct inbox initial load failed', err)
      /**
       * Выполняет метод `setError`.
       * @returns Результат выполнения `setError`.
       */

      setError('Не удалось загрузить список чатов')
    } finally {
      /**
       * Выполняет метод `setLoading`.
       * @param false Входной параметр `false`.
       * @returns Результат выполнения `setLoading`.
       */

      setLoading(false)
    }
  }, [user])

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data) as Record<string, unknown>
        if (payload.type === 'direct_unread_state') {
          /**
           * Выполняет метод `applyUnreadState`.
           * @returns Результат выполнения `applyUnreadState`.
           */

          applyUnreadState(payload.unread)
          return
        }

        if (payload.type === 'direct_inbox_item') {
          const item = normalizeItem(payload.item)
          if (item) {
            /**
             * Выполняет метод `setItems`.
             * @returns Результат выполнения `setItems`.
             */

            setItems((prev) => mergeItem(prev, item))
          }
          /**
           * Выполняет метод `invalidateDirectChats`.
           * @returns Результат выполнения `invalidateDirectChats`.
           */

          invalidateDirectChats()
          if (payload.unread) {
            /**
             * Выполняет метод `applyUnreadState`.
             * @returns Результат выполнения `applyUnreadState`.
             */

            applyUnreadState(payload.unread)
          }
          return
        }

        if (payload.type === 'direct_mark_read_ack') {
          /**
           * Выполняет метод `applyUnreadState`.
           * @returns Результат выполнения `applyUnreadState`.
           */

          applyUnreadState(payload.unread)
          return
        }

        if (payload.type === 'error') {
          const code = typeof payload.code === 'string' ? payload.code : 'unknown'
          if (code === 'forbidden') {
            /**
             * Выполняет метод `setError`.
             * @returns Результат выполнения `setError`.
             */

            setError('Недостаточно прав для этого чата')
          }
        }
      } catch (err) {
        /**
         * Выполняет метод `debugLog`.
         * @param err Входной параметр `err`.
         * @returns Результат выполнения `debugLog`.
         */

        debugLog('Direct inbox WS parse failed', err)
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
      /**
       * Выполняет метод `send`.
       * @returns Результат выполнения `send`.
       */

      send(JSON.stringify({ type: 'set_active_room', roomSlug }))
    },
    [send, status],
  )

  const markRead = useCallback(
    (roomSlug: string) => {
      const slug = roomSlug.trim()
      if (!slug) return

      /**
       * Выполняет метод `setUnreadSlugs`.
       * @returns Результат выполнения `setUnreadSlugs`.
       */

      setUnreadSlugs((prev) => {
        if (!prev.includes(slug)) return prev
        const next = prev.filter((item) => item !== slug)
        /**
         * Выполняет метод `setUnreadDialogsCount`.
         * @returns Результат выполнения `setUnreadDialogsCount`.
         */

        setUnreadDialogsCount(next.length)
        return next
      })
      /**
       * Выполняет метод `setUnreadCounts`.
       * @returns Результат выполнения `setUnreadCounts`.
       */

      setUnreadCounts((prev) => {
        if (!(slug in prev)) return prev
        const next = { ...prev }
        delete next[slug]
        return next
      })

      if (status !== 'online') return
      /**
       * Выполняет метод `send`.
       * @returns Результат выполнения `send`.
       */

      send(JSON.stringify({ type: 'mark_read', roomSlug: slug }))
    },
    [send, status],
  )

  /**
   * Выполняет метод `useEffect`.
   * @param props Входной параметр `props`.
   * @returns Результат выполнения `useEffect`.
   */

  useEffect(() => {
    let active = true

    if (!ready || !user) {
      /**
       * Выполняет метод `queueMicrotask`.
       * @returns Результат выполнения `queueMicrotask`.
       */

      queueMicrotask(() => {
        if (!active) return
        /**
         * Выполняет метод `setItems`.
         * @param props Входной параметр `props`.
         * @returns Результат выполнения `setItems`.
         */

        setItems([])
        /**
         * Выполняет метод `setUnreadSlugs`.
         * @param props Входной параметр `props`.
         * @returns Результат выполнения `setUnreadSlugs`.
         */

        setUnreadSlugs([])
        /**
         * Выполняет метод `setUnreadCounts`.
         * @param props Входной параметр `props`.
         * @returns Результат выполнения `setUnreadCounts`.
         */

        setUnreadCounts({})
        /**
         * Выполняет метод `setUnreadDialogsCount`.
         * @returns Результат выполнения `setUnreadDialogsCount`.
         */

        setUnreadDialogsCount(0)
        /**
         * Выполняет метод `setLoading`.
         * @param false Входной параметр `false`.
         * @returns Результат выполнения `setLoading`.
         */

        setLoading(false)
        /**
         * Выполняет метод `setError`.
         * @param null Входной параметр `null`.
         * @returns Результат выполнения `setError`.
         */

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

  /**
   * Выполняет метод `useEffect`.
   * @param props Входной параметр `props`.
   * @returns Результат выполнения `useEffect`.
   */

  useEffect(() => {
    if (status !== 'online') return

    /**
     * Выполняет метод `send`.
     * @returns Результат выполнения `send`.
     */

    send(JSON.stringify({ type: 'ping', ts: Date.now() }))
    /**
     * Выполняет метод `send`.
     * @returns Результат выполнения `send`.
     */

    send(JSON.stringify({ type: 'set_active_room', roomSlug: activeRoomRef.current }))

    const id = window.setInterval(() => {
      /**
       * Выполняет метод `send`.
       * @returns Результат выполнения `send`.
       */

      send(JSON.stringify({ type: 'ping', ts: Date.now() }))
    }, DIRECT_INBOX_PING_MS)

    return () => {
      window.clearInterval(id)
    }
  }, [send, status])

  /**
   * Выполняет метод `useEffect`.
   * @param props Входной параметр `props`.
   * @returns Результат выполнения `useEffect`.
   */

  useEffect(() => {
    if (!lastError || status !== 'error') return
    /**
     * Выполняет метод `queueMicrotask`.
     * @returns Результат выполнения `queueMicrotask`.
     */

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
