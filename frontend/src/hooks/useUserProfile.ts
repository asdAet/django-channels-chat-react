import { useEffect, useMemo, useState } from 'react'

import { apiService } from '../adapters/ApiService'
import type { UserProfile } from '../entities/user/types'
import { debugLog } from '../shared/lib/debug'

type InternalState = {
  username: string | null
  user: UserProfile | null
  error: string | null
}

export type UserProfileState = {
  user: UserProfile | null
  loading: boolean
  error: string | null
}

/**
 * Управляет состоянием и эффектами хука `useUserProfile`.
 * @param username Входной параметр `username`.
 * @returns Результат выполнения `useUserProfile`.
 */

export const useUserProfile = (username: string) => {
  const [state, setState] = useState<InternalState>({
    username: null,
    user: null,
    error: null,
  })

  const hasUsername = Boolean(username)

  /**
   * Выполняет метод `useEffect`.
   * @returns Результат выполнения `useEffect`.
   */

  useEffect(() => {
    if (!hasUsername) return

    let active = true

    apiService
      .getUserProfile(username)
      .then((payload) => {
        if (!active) return
        const user = payload.user
        /**
         * Выполняет метод `setState`.
         * @param props Входной параметр `props`.
         * @returns Результат выполнения `setState`.
         */

        setState({
          username,
          user: {
            username: user.username,
            email: user.email || '',
            profileImage: user.profileImage || null,
            bio: user.bio || '',
            lastSeen: user.lastSeen || null,
            registeredAt: user.registeredAt || null,
          },
          error: null,
        })
      })
      .catch((err) => {
        /**
         * Выполняет метод `debugLog`.
         * @param err Входной параметр `err`.
         * @returns Результат выполнения `debugLog`.
         */

        debugLog('User profile fetch failed', err)
        if (!active) return
        /**
         * Выполняет метод `setState`.
         * @param props Входной параметр `props`.
         * @returns Результат выполнения `setState`.
         */

        setState({ username, user: null, error: 'not_found' })
      })

    return () => {
      active = false
    }
  }, [hasUsername, username])

  return useMemo<UserProfileState>(() => {
    if (!hasUsername) {
      return { user: null, loading: false, error: 'not_found' }
    }

    const isStale = state.username !== username
    const user = isStale ? null : state.user
    const error = isStale ? null : state.error
    const loading = isStale || (!user && !error)

    return { user, loading, error }
  }, [hasUsername, state.error, state.user, state.username, username])
}
