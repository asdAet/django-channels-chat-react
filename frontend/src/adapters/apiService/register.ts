import type { AxiosInstance } from 'axios'

import type { SessionResponse } from '../../shared/api/types'

/**
 * Выполняет функцию `register`.
 * @param apiClient Входной параметр `apiClient`.
 * @param username Входной параметр `username`.
 * @param password1 Входной параметр `password1`.
 * @param password2 Входной параметр `password2`.
 * @returns Результат выполнения `register`.
 */

export async function register(
  apiClient: AxiosInstance,
  username: string,
  password1: string,
  password2: string,
): Promise<SessionResponse> {
  const response = await apiClient.post<SessionResponse>('/auth/register/', {
    username,
    password1,
    password2,
  })
  return response.data
}
