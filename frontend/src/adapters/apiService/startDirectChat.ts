import type { AxiosInstance } from 'axios'

import { decodeDirectStartResponse } from '../../dto'
import type { DirectStartResponse } from '../../domain/interfaces/IApiService'

/**
 * Создает или возвращает direct-чат по username.
 * @param apiClient HTTP-клиент.
 * @param username Имя собеседника.
 * @returns Нормализованные данные direct-комнаты.
 */
export const startDirectChat = async (
  apiClient: AxiosInstance,
  username: string,
): Promise<DirectStartResponse> => {
  const response = await apiClient.post<unknown>('/chat/direct/start/', { username })
  return decodeDirectStartResponse(response.data)
}

