import type { AxiosInstance } from 'axios'

import { decodeRoomDetailsResponse } from '../../dto'
import type { RoomDetails } from '../../entities/room/types'

/**
 * Загружает детали комнаты по slug.
 * @param apiClient HTTP-клиент.
 * @param slug Идентификатор комнаты.
 * @returns Нормализованные данные комнаты.
 */
export async function getRoomDetails(apiClient: AxiosInstance, slug: string): Promise<RoomDetails> {
  const encodedSlug = encodeURIComponent(slug)
  const response = await apiClient.get<unknown>(`/chat/rooms/${encodedSlug}/`)
  return decodeRoomDetailsResponse(response.data)
}

