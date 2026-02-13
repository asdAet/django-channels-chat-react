import type { AxiosInstance } from 'axios'

/**
 * Выполняет функцию `getPasswordRules`.
 * @param apiClient Входной параметр `apiClient`.
 * @returns Результат выполнения `getPasswordRules`.
 */

export async function getPasswordRules(
  apiClient: AxiosInstance,
): Promise<{ rules: string[] }> {
  const response = await apiClient.get<{ rules: string[] }>('/auth/password-rules/')
  return response.data
}
