import type { AxiosInstance } from 'axios'

import type { SessionResponse } from '../../shared/api/types'

/**
 * Выполняет функцию `getSession`.
 * @param apiClient Входной параметр `apiClient`.
 * @returns Результат выполнения `getSession`.
 */

export async function getSession(apiClient: AxiosInstance): Promise<SessionResponse> {
  const response = await apiClient.get<SessionResponse>('/auth/session/')
  return response.data
}
