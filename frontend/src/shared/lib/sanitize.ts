const TAGS = /<[^>]*>/g

/**
 * Выполняет функцию `stripControlChars`.
 * @param value Входной параметр `value`.
 * @returns Результат выполнения `stripControlChars`.
 */

const stripControlChars = (value: string) => {
  let cleaned = ''
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i)
    if (
      (code >= 0 && code <= 8) ||
      code === 11 ||
      code === 12 ||
      (code >= 14 && code <= 31) ||
      code === 127
    ) {
      continue
    }
    cleaned += value[i]
  }
  return cleaned
}

/**
 * Выполняет функцию `sanitizeText`.
 * @param input Входной параметр `input`.
 * @param maxLen Входной параметр `maxLen`.
 * @returns Результат выполнения `sanitizeText`.
 */

export const sanitizeText = (input: string, maxLen = 1000) => {
  if (!input) return ''
  const withoutTags = input.replace(TAGS, '')
  const withoutControls = stripControlChars(withoutTags)
  const trimmed = withoutControls.trim()
  if (trimmed.length > maxLen) {
    return trimmed.slice(0, maxLen)
  }
  return trimmed
}
