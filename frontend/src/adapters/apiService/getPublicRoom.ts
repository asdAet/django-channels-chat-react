import type { AxiosInstance } from 'axios'

import { decodePublicRoomResponse } from '../../dto'
import type { RoomDetails } from '../../entities/room/types'

/**
 * Загружает данные публичной комнаты.
 * @param apiClient HTTP-клиент.
 * @returns Нормализованные данные комнаты.
 */
export async function getPublicRoom(apiClient: AxiosInstance): Promise<RoomDetails> {
  const response = await apiClient.get<unknown>('/chat/public-room/')
  return decodePublicRoomResponse(response.data)
}

