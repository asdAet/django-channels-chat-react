import type { AxiosInstance } from 'axios'

/**
 * Выполняет функцию `ensureCsrf`.
 * @param apiClient Входной параметр `apiClient`.
 * @returns Результат выполнения `ensureCsrf`.
 */

export async function ensureCsrf(apiClient: AxiosInstance): Promise<{ csrfToken: string }> {
  const response = await apiClient.get<{ csrfToken: string }>('/auth/csrf/')
  return response.data
}
