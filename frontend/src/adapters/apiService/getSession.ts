import type { AxiosInstance } from 'axios'

import { decodeSessionResponse } from '../../dto'
import type { SessionResponse } from '../../domain/interfaces/IApiService'

/**
 * Загружает текущую сессию пользователя.
 * @param apiClient HTTP-клиент.
 * @returns Декодированное состояние сессии.
 */
export async function getSession(apiClient: AxiosInstance): Promise<SessionResponse> {
  const response = await apiClient.get<unknown>('/auth/session/')
  return decodeSessionResponse(response.data)
}

