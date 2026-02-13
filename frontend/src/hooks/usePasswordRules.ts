import { useEffect, useState } from 'react'

import { authController } from '../controllers/AuthController'
import { debugLog } from '../shared/lib/debug'

/**
 * Управляет состоянием и эффектами хука `usePasswordRules`.
 * @param enabled Входной параметр `enabled`.
 * @returns Результат выполнения `usePasswordRules`.
 */

export const usePasswordRules = (enabled: boolean) => {
  const [rules, setRules] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  /**
   * Выполняет метод `useEffect`.
   * @param props Входной параметр `props`.
   * @returns Результат выполнения `useEffect`.
   */

  useEffect(() => {
    if (!enabled) return
    let active = true
    /**
     * Выполняет метод `queueMicrotask`.
     * @returns Результат выполнения `queueMicrotask`.
     */

    queueMicrotask(() => setLoading(true))
    authController
      .getPasswordRules()
      .then((data) => {
        if (!active) return
        /**
         * Выполняет метод `setRules`.
         * @returns Результат выполнения `setRules`.
         */

        setRules(Array.isArray(data.rules) ? data.rules : [])
      })
      .catch((err) => {
        /**
         * Выполняет метод `debugLog`.
         * @param err Входной параметр `err`.
         * @returns Результат выполнения `debugLog`.
         */

        debugLog('Password rules fetch failed', err)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [enabled])

  return { rules, loading }
}
