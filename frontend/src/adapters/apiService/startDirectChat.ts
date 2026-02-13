import type { AxiosInstance } from 'axios'

import type { DirectStartResponse } from '../../domain/interfaces/IApiService'

/**
 * Выполняет функцию `startDirectChat`.
 * @param apiClient Входной параметр `apiClient`.
 * @param username Входной параметр `username`.
 * @returns Результат выполнения `startDirectChat`.
 */

export const startDirectChat = async (apiClient: AxiosInstance, username: string): Promise<DirectStartResponse> => {
  const { data } = await apiClient.post('/chat/direct/start/', { username })
  return data as DirectStartResponse
}
