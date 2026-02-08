import { useCallback, useEffect, useState } from 'react'

import { chatController } from '../controllers/ChatController'
import type { RoomDetailsDto } from '../dto/chat'
import type { Message } from '../entities/message/types'
import type { UserProfileDto } from '../dto/auth'
import { debugLog } from '../shared/lib/debug'

export type ChatRoomState = {
  details: RoomDetailsDto | null
  messages: Message[]
  loading: boolean
  error: string | null
}

export const useChatRoom = (slug: string, user: UserProfileDto | null) => {
  const [state, setState] = useState<ChatRoomState>({
    details: null,
    messages: [],
    loading: true,
    error: null,
  })

  useEffect(() => {
    if (!user) return
    let active = true
    queueMicrotask(() => setState((prev) => ({ ...prev, loading: true })))
    Promise.all([chatController.getRoomDetails(slug), chatController.getRoomMessages(slug)])
      .then(([info, payload]) => {
        if (!active) return
        setState({ details: info, messages: payload.messages, loading: false, error: null })
      })
      .catch((err) => {
        if (!active) return
        debugLog('Room load failed', err)
        setState((prev) => ({ ...prev, loading: false, error: 'load_failed' }))
      })

    return () => {
      active = false
    }
  }, [slug, user])

  const setMessages = useCallback((updater: Message[] | ((prev: Message[]) => Message[])) => {
    setState((prev) => {
      const nextMessages = typeof updater === 'function' ? updater(prev.messages) : updater
      return { ...prev, messages: nextMessages }
    })
  }, [])

  const setError = useCallback((error: string | null) => {
    setState((prev) => ({ ...prev, error }))
  }, [])

  return {
    details: state.details,
    messages: state.messages,
    loading: state.loading,
    error: state.error,
    setMessages,
    setError,
  }
}

