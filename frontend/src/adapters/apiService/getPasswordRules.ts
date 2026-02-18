import type { AxiosInstance } from 'axios'

import { decodePasswordRulesResponse } from '../../dto'

/**
 * Загружает подсказки по правилам пароля.
 * @param apiClient HTTP-клиент.
 * @returns Нормализованный список правил.
 */
export async function getPasswordRules(apiClient: AxiosInstance): Promise<{ rules: string[] }> {
  const response = await apiClient.get<unknown>('/auth/password-rules/')
  return decodePasswordRulesResponse(response.data)
}

