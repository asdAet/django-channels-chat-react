/**
 * Выполняет функцию `getWebSocketBase`.
 * @returns Результат выполнения `getWebSocketBase`.
 */

export const getWebSocketBase = () => {
  const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws'
  if (import.meta.env.DEV) {
    return `${scheme}://${window.location.hostname}:8000`
  }
  return `${scheme}://${window.location.host}`
}
