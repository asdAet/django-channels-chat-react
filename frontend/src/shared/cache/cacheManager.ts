import { encodeSwCacheMessage, type SwCacheMessage } from '../../dto'

const postMessage = (message: SwCacheMessage): void => {
  if (typeof navigator === 'undefined') return
  if (!navigator.serviceWorker) return

  const payload = encodeSwCacheMessage(message)
  const controller = navigator.serviceWorker.controller
  if (controller) {
    controller.postMessage(payload)
    return
  }

  navigator.serviceWorker.ready
    .then((registration) => {
      registration.active?.postMessage(payload)
    })
    .catch(() => {})
}

/**
 * Инвалидирует кэш сообщений комнаты.
 * @param slug Идентификатор комнаты.
 */
export const invalidateRoomMessages = (slug: string) => {
  if (!slug) return
  postMessage({ type: 'invalidate', key: 'roomMessages', slug })
}

/**
 * Инвалидирует кэш деталей комнаты.
 * @param slug Идентификатор комнаты.
 */
export const invalidateRoomDetails = (slug: string) => {
  if (!slug) return
  postMessage({ type: 'invalidate', key: 'roomDetails', slug })
}

/**
 * Инвалидирует кэш списка direct-чатов.
 */
export const invalidateDirectChats = () => {
  postMessage({ type: 'invalidate', key: 'directChats' })
}

/**
 * Инвалидирует кэш публичного профиля пользователя.
 * @param username Имя пользователя.
 */
export const invalidateUserProfile = (username: string) => {
  if (!username) return
  postMessage({ type: 'invalidate', key: 'userProfile', username })
}

/**
 * Инвалидирует кэш собственного профиля.
 */
export const invalidateSelfProfile = () => {
  postMessage({ type: 'invalidate', key: 'selfProfile' })
}

/**
 * Очищает все пользовательские API-кэши.
 */
export const clearAllUserCaches = () => {
  postMessage({ type: 'clearUserCaches' })
}

