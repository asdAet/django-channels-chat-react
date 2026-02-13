export type Route =
  | { name: 'home' }
  | { name: 'login' }
  | { name: 'register' }
  | { name: 'profile' }
  | { name: 'directInbox' }
  | { name: 'directByUsername'; username: string }
  | { name: 'user'; username: string }
  | { name: 'room'; slug: string }

const ROOM_SLUG_RE = /^[A-Za-z0-9_-]{3,50}$/

/**
 * Выполняет функцию `isValidRoomSlug`.
 * @param value Входной параметр `value`.
 * @returns Результат выполнения `isValidRoomSlug`.
 */

const isValidRoomSlug = (value: string) => ROOM_SLUG_RE.test(value)

/**
 * Выполняет функцию `parseRoute`.
 * @param pathname Входной параметр `pathname`.
 * @returns Результат выполнения `parseRoute`.
 */

export const parseRoute = (pathname: string): Route => {
  const normalized = pathname.replace(/\/+$/, '') || '/'
  if (normalized === '/login') return { name: 'login' }
  if (normalized === '/register') return { name: 'register' }
  if (normalized === '/profile') return { name: 'profile' }
  if (normalized === '/direct') return { name: 'directInbox' }
  if (normalized.startsWith('/direct/@')) {
    const username = decodeURIComponent(normalized.replace('/direct/@', '') || '')
    if (!username || username.includes('/')) return { name: 'home' }
    return { name: 'directByUsername', username }
  }
  if (normalized.startsWith('/users/')) {
    const username = decodeURIComponent(normalized.replace('/users/', '') || '')
    return { name: 'user', username }
  }
  if (normalized.startsWith('/rooms/')) {
    const slug = decodeURIComponent(normalized.replace('/rooms/', '') || '')
    if (!isValidRoomSlug(slug)) return { name: 'home' }
    return { name: 'room', slug }
  }
  return { name: 'home' }
}

/**
 * Выполняет функцию `navigate`.
 * @param path Входной параметр `path`.
 * @param setRoute Входной параметр `setRoute`.
 * @returns Результат выполнения `navigate`.
 */

export const navigate = (path: string, setRoute: (route: Route) => void) => {
  if (path !== window.location.pathname) {
    window.history.pushState({}, '', path)
  }
  /**
   * Выполняет метод `setRoute`.
   * @returns Результат выполнения `setRoute`.
   */

  setRoute(parseRoute(path))
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
