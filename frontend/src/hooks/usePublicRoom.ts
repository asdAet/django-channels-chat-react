import { useEffect, useState } from 'react'

import { chatController } from '../controllers/ChatController'
import type { RoomDetailsDto } from '../dto/chat'
import type { UserProfileDto } from '../dto/auth'
import { debugLog } from '../shared/lib/debug'

export const usePublicRoom = (user: UserProfileDto | null) => {
  const [publicRoom, setPublicRoom] = useState<RoomDetailsDto | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    queueMicrotask(() => setLoading(true))
    let active = true
    chatController
      .getPublicRoom()
      .then((room) => {
        if (active) setPublicRoom(room)
      })
      .catch(() => {
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

