import { useEffect, useState } from 'react'

import { chatController } from '../controllers/ChatController'
import type { RoomDetailsDto } from '../dto/chat'
import type { UserProfileDto } from '../dto/auth'
import { debugLog } from '../shared/lib/debug'

/**
 * Управляет состоянием и эффектами хука `usePublicRoom`.
 * @param user Входной параметр `user`.
 * @returns Результат выполнения `usePublicRoom`.
 */

export const usePublicRoom = (user: UserProfileDto | null) => {
  const [publicRoom, setPublicRoom] = useState<RoomDetailsDto | null>(null)
  const [loading, setLoading] = useState(false)

  /**
   * Выполняет метод `useEffect`.
   * @param props Входной параметр `props`.
   * @returns Результат выполнения `useEffect`.
   */

  useEffect(() => {
    /**
     * Выполняет метод `queueMicrotask`.
     * @returns Результат выполнения `queueMicrotask`.
     */

    queueMicrotask(() => setLoading(true))
    let active = true
    chatController
      .getPublicRoom()
      .then((room) => {
        if (active) setPublicRoom(room)
      })
      .catch(() => {
        /**
         * Выполняет метод `debugLog`.
         * @returns Результат выполнения `debugLog`.
         */

        debugLog('Public room fetch failed')
        if (active) setPublicRoom(null)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [user])

  return { publicRoom, loading }
}

