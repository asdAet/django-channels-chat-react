import type { AxiosInstance } from 'axios'

import { decodeClientConfigResponse } from '../../dto'

/**
 * Загружает runtime-конфиг клиента из backend policy endpoint.
 */
export const getClientConfig = async (apiClient: AxiosInstance) => {
  const response = await apiClient.get('/meta/client-config/')
  return decodeClientConfigResponse(response.data)
}
