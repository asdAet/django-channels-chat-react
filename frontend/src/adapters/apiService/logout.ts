import type { AxiosInstance } from 'axios'

import { decodeLogoutResponse } from '../../dto'

/**
 * Выполняет logout и декодирует DTO-ответ.
 * @param apiClient HTTP-клиент.
 * @returns Признак успешного выхода.
 */
export async function logout(apiClient: AxiosInstance): Promise<{ ok: boolean }> {
  const response = await apiClient.post<unknown>('/auth/logout/')
  return decodeLogoutResponse(response.data)
}

