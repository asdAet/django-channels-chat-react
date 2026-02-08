import { useCallback } from 'react'

import { chatController } from '../controllers/ChatController'

export const useChatActions = () => {
  const getRoomDetails = useCallback((slug: string) => chatController.getRoomDetails(slug), [])
  const getRoomMessages = useCallback((slug: string) => chatController.getRoomMessages(slug), [])

  return {
    getRoomDetails,
    getRoomMessages,
  }
}

