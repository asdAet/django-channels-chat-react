import { useContext } from 'react'

import { PresenceContext } from './context'

/**
 * Управляет состоянием и эффектами хука `usePresence`.
 * @returns Результат выполнения `usePresence`.
 */

export const usePresence = () => useContext(PresenceContext)
