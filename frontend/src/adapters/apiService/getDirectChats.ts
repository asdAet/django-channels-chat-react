import type { AxiosInstance } from 'axios'

import type { DirectChatsResponse } from '../../domain/interfaces/IApiService'

/**
 * Выполняет функцию `getDirectChats`.
 * @param apiClient Входной параметр `apiClient`.
 * @returns Результат выполнения `getDirectChats`.
 */

export const getDirectChats = async (apiClient: AxiosInstance): Promise<DirectChatsResponse> => {
  const { data } = await apiClient.get('/chat/direct/chats/')
  return data as DirectChatsResponse
}
