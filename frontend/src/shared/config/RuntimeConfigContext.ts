import { createContext, useContext } from 'react'

import type { ClientRuntimeConfig } from '../../domain/interfaces/IApiService'
import { DEFAULT_RUNTIME_CONFIG } from './runtimeConfig'

export type RuntimeConfigContextValue = {
  config: ClientRuntimeConfig
  ready: boolean
}

export const RuntimeConfigContext = createContext<RuntimeConfigContextValue>({
  config: DEFAULT_RUNTIME_CONFIG,
  ready: false,
})

/**
 * Возвращает runtime policy-конфиг frontend.
 */
export function useRuntimeConfig(): RuntimeConfigContextValue {
  return useContext(RuntimeConfigContext)
}
