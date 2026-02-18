import { z } from 'zod'

const csrfTokenSchema = z.string().trim().min(1)

const cookieNameSchema = z.string().trim().min(1)

/**
 * Извлекает значение cookie по имени.
 * @param cookie Сырой document.cookie.
 * @param name Имя cookie.
 * @returns Значение cookie или null.
 */
export const readCookieValue = (cookie: string | null | undefined, name: string): string | null => {
  const cookieName = cookieNameSchema.safeParse(name)
  if (!cookieName.success) return null
  if (!cookie) return null

  const chunks = cookie.split(';').map((entry) => entry.trim())
  const match = chunks.find((entry) => entry.startsWith(`${cookieName.data}=`))
  if (!match) return null

  const value = match.slice(cookieName.data.length + 1)
  const parsed = csrfTokenSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

/**
 * Читает csrf token из document.cookie в браузере.
 * @returns Значение csrf cookie или null.
 */
export const readCsrfFromCookie = (): string | null => {
  if (typeof document === 'undefined') return null
  return readCookieValue(document.cookie, 'csrftoken')
}

/**
 * Читает csrf token из sessionStorage.
 * @param storageKey Ключ в sessionStorage.
 * @returns Значение csrf token или null.
 */
export const readCsrfFromSessionStorage = (storageKey: string): string | null => {
  if (typeof sessionStorage === 'undefined') return null
  const raw = sessionStorage.getItem(storageKey)
  const parsed = csrfTokenSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

/**
 * Сохраняет csrf token в sessionStorage.
 * @param storageKey Ключ в sessionStorage.
 * @param token Значение токена.
 */
export const writeCsrfToSessionStorage = (storageKey: string, token: string | null): void => {
  if (typeof sessionStorage === 'undefined') return

  if (!token) {
    sessionStorage.removeItem(storageKey)
    return
  }

  const parsed = csrfTokenSchema.safeParse(token)
  if (!parsed.success) {
    sessionStorage.removeItem(storageKey)
    return
  }

  sessionStorage.setItem(storageKey, parsed.data)
}
