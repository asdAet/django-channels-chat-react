import type { AxiosInstance } from 'axios'

import type { SessionResponse } from '../../shared/api/types'

/**
 * Выполняет функцию `login`.
 * @param apiClient Входной параметр `apiClient`.
 * @param username Входной параметр `username`.
 * @param password Входной параметр `password`.
 * @returns Результат выполнения `login`.
 */

export async function login(
  apiClient: AxiosInstance,
  username: string,
  password: string,
): Promise<SessionResponse> {
  const response = await apiClient.post<SessionResponse>('/auth/login/', { username, password })
  return response.data
}
