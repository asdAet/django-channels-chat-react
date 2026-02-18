import type { AxiosInstance } from 'axios'

import { decodeDirectChatsResponse } from '../../dto'
import type { DirectChatsResponse } from '../../domain/interfaces/IApiService'

/**
 * Загружает список direct-чатов текущего пользователя.
 * @param apiClient HTTP-клиент.
 * @returns Нормализованный список direct-чатов.
 */
export const getDirectChats = async (apiClient: AxiosInstance): Promise<DirectChatsResponse> => {
  const response = await apiClient.get<unknown>('/chat/direct/chats/')
  return decodeDirectChatsResponse(response.data)
}

