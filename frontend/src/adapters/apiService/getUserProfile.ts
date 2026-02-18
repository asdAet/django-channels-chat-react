import type { AxiosInstance } from 'axios'

import { decodeProfileEnvelopeResponse } from '../../dto'
import type { UserProfile } from '../../entities/user/types'

/**
 * Загружает публичный профиль пользователя.
 * @param apiClient HTTP-клиент.
 * @param username Имя пользователя.
 * @returns Нормализованный профиль пользователя.
 */
export async function getUserProfile(
  apiClient: AxiosInstance,
  username: string,
): Promise<{ user: UserProfile }> {
  const safe = encodeURIComponent(username)
  const response = await apiClient.get<unknown>(`/auth/users/${safe}/`)
  return decodeProfileEnvelopeResponse(response.data)
}

