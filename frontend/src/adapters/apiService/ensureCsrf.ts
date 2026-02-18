import type { AxiosInstance } from 'axios'

import { decodeCsrfResponse } from '../../dto'

/**
 * Выполняет запрос CSRF и декодирует DTO-ответ.
 * @param apiClient HTTP-клиент.
 * @returns Нормализованный CSRF payload.
 */
export async function ensureCsrf(apiClient: AxiosInstance): Promise<{ csrfToken: string }> {
  const response = await apiClient.get<unknown>('/auth/csrf/')
  return decodeCsrfResponse(response.data)
}

