/**
 * Выполняет функцию `debugLog`.
 * @param args Входной параметр `args`.
 * @returns Результат выполнения `debugLog`.
 */

export const debugLog = (...args: unknown[]) => {
  if (import.meta.env.DEV && import.meta.env.MODE !== 'test') {
    console.error('[Debug]', ...args)
  }
}
