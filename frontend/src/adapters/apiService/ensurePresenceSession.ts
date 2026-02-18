import type { AxiosInstance } from 'axios'

import { decodePresenceSessionResponse } from '../../dto'

/**
 * Фиксирует гостевую session перед presence websocket.
 * @param apiClient HTTP-клиент.
 * @returns Признак успешного bootstrap.
 */
export async function ensurePresenceSession(apiClient: AxiosInstance): Promise<{ ok: boolean }> {
  const response = await apiClient.get<unknown>('/auth/presence-session/')
  return decodePresenceSessionResponse(response.data)
}

