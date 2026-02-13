import type { AxiosInstance } from 'axios'

/**
 * Выполняет функцию `logout`.
 * @param apiClient Входной параметр `apiClient`.
 * @returns Результат выполнения `logout`.
 */

export async function logout(apiClient: AxiosInstance): Promise<{ ok: boolean }> {
  const response = await apiClient.post<{ ok: boolean }>('/auth/logout/')
  return response.data
}
