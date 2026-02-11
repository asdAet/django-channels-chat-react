export const formatTimestamp = (iso: string) =>
  new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))

export const formatDayLabel = (date: Date, now: Date = new Date()) => {
  if (Number.isNaN(date.getTime())) return ''
  const includeYear = date.getFullYear() !== now.getFullYear()
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' }
  if (includeYear) {
    options.year = 'numeric'
  }
  return new Intl.DateTimeFormat('ru-RU', options).format(date)
}

export const avatarFallback = (username: string) =>
  username ? username[0].toUpperCase() : '?'

export const formatRegistrationDate = (iso: string | null) => {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}
