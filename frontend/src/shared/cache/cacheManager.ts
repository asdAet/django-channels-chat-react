type InvalidateMessage =
  | { type: 'invalidate'; key: 'roomMessages'; slug: string }
  | { type: 'invalidate'; key: 'roomDetails'; slug: string }
  | { type: 'invalidate'; key: 'directChats' }
  | { type: 'invalidate'; key: 'userProfile'; username: string }
  | { type: 'invalidate'; key: 'selfProfile' }

type ClearMessage = { type: 'clearUserCaches' }

/**
 * Выполняет функцию `postMessage`.
 * @param message Входной параметр `message`.
 * @returns Результат выполнения `postMessage`.
 */

const postMessage = (message: InvalidateMessage | ClearMessage) => {
  if (typeof navigator === 'undefined') return
  if (!navigator.serviceWorker) return

  const controller = navigator.serviceWorker.controller
  if (controller) {
    controller.postMessage(message)
    return
  }

  navigator.serviceWorker.ready
    .then((registration) => {
      registration.active?.postMessage(message)
    })
    .catch(() => {})
}

/**
 * Выполняет функцию `invalidateRoomMessages`.
 * @param slug Входной параметр `slug`.
 * @returns Результат выполнения `invalidateRoomMessages`.
 */

export const invalidateRoomMessages = (slug: string) => {
  if (!slug) return
  /**
   * Выполняет метод `postMessage`.
   * @param props Входной параметр `props`.
   * @returns Результат выполнения `postMessage`.
   */

  postMessage({ type: 'invalidate', key: 'roomMessages', slug })
}

/**
 * Выполняет функцию `invalidateRoomDetails`.
 * @param slug Входной параметр `slug`.
 * @returns Результат выполнения `invalidateRoomDetails`.
 */

export const invalidateRoomDetails = (slug: string) => {
  if (!slug) return
  /**
   * Выполняет метод `postMessage`.
   * @param props Входной параметр `props`.
   * @returns Результат выполнения `postMessage`.
   */

  postMessage({ type: 'invalidate', key: 'roomDetails', slug })
}

/**
 * Выполняет функцию `invalidateDirectChats`.
 * @returns Результат выполнения `invalidateDirectChats`.
 */

export const invalidateDirectChats = () => {
  /**
   * Выполняет метод `postMessage`.
   * @param props Входной параметр `props`.
   * @returns Результат выполнения `postMessage`.
   */

  postMessage({ type: 'invalidate', key: 'directChats' })
}

/**
 * Выполняет функцию `invalidateUserProfile`.
 * @param username Входной параметр `username`.
 * @returns Результат выполнения `invalidateUserProfile`.
 */

export const invalidateUserProfile = (username: string) => {
  if (!username) return
  /**
   * Выполняет метод `postMessage`.
   * @param props Входной параметр `props`.
   * @returns Результат выполнения `postMessage`.
   */

  postMessage({ type: 'invalidate', key: 'userProfile', username })
}

/**
 * Выполняет функцию `invalidateSelfProfile`.
 * @returns Результат выполнения `invalidateSelfProfile`.
 */

export const invalidateSelfProfile = () => {
  /**
   * Выполняет метод `postMessage`.
   * @param props Входной параметр `props`.
   * @returns Результат выполнения `postMessage`.
   */

  postMessage({ type: 'invalidate', key: 'selfProfile' })
}

/**
 * Выполняет функцию `clearAllUserCaches`.
 * @returns Результат выполнения `clearAllUserCaches`.
 */

export const clearAllUserCaches = () => {
  /**
   * Выполняет метод `postMessage`.
   * @param props Входной параметр `props`.
   * @returns Результат выполнения `postMessage`.
   */

  postMessage({ type: 'clearUserCaches' })
}
