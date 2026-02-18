import type { AxiosInstance } from 'axios'

import { buildRegisterRequestDto, decodeSessionResponse } from '../../dto'
import type { SessionResponse } from '../../domain/interfaces/IApiService'

/**
 * Выполняет регистрацию пользователя.
 * @param apiClient HTTP-клиент.
 * @param username Логин.
 * @param password1 Пароль.
 * @param password2 Повтор пароля.
 * @returns Декодированное состояние сессии.
 */
export async function register(
  apiClient: AxiosInstance,
  username: string,
  password1: string,
  password2: string,
): Promise<SessionResponse> {
  const body = buildRegisterRequestDto({ username, password1, password2 })
  const response = await apiClient.post<unknown>('/auth/register/', body)
  return decodeSessionResponse(response.data)
}

