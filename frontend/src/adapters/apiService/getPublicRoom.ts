import type { AxiosInstance } from 'axios'

import type { RoomDetails } from '../../entities/room/types'

/**
 * Выполняет функцию `getPublicRoom`.
 * @param apiClient Входной параметр `apiClient`.
 * @returns Результат выполнения `getPublicRoom`.
 */

export async function getPublicRoom(apiClient: AxiosInstance): Promise<RoomDetails> {
  const response = await apiClient.get<RoomDetails>('/chat/public-room/')
  return response.data
}
