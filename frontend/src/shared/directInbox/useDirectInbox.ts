import { useContext } from 'react'

import { DirectInboxContext } from './context'

/**
 * Управляет состоянием и эффектами хука `useDirectInbox`.
 * @returns Результат выполнения `useDirectInbox`.
 */

export const useDirectInbox = () => useContext(DirectInboxContext)
