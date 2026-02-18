import type { AxiosInstance } from 'axios'

import { decodeRoomMessagesResponse } from '../../dto'
import type { RoomMessagesResponse } from '../../domain/interfaces/IApiService'

/**
 * Загружает сообщения комнаты с пагинацией.
 * @param apiClient HTTP-клиент.
 * @param slug Идентификатор комнаты.
 * @param params Параметры пагинации.
 * @returns Нормализованный список сообщений.
 */
export async function getRoomMessages(
  apiClient: AxiosInstance,
  slug: string,
  params?: { limit?: number; beforeId?: number },
): Promise<RoomMessagesResponse> {
  const encodedSlug = encodeURIComponent(slug)
  const query = new URLSearchParams()
  if (params?.limit) {
    query.set('limit', String(params.limit))
  }
  if (params?.beforeId) {
    query.set('before', String(params.beforeId))
  }

  const suffix = query.toString()
  const url = `/chat/rooms/${encodedSlug}/messages/${suffix ? `?${suffix}` : ''}`
  const response = await apiClient.get<unknown>(url)
  return decodeRoomMessagesResponse(response.data)
}

