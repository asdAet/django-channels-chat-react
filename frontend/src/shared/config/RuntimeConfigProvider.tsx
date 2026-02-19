import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { apiService } from '../../adapters/ApiService'
import type { ClientRuntimeConfig } from '../../domain/interfaces/IApiService'
import { debugLog } from '../lib/debug'
import { RuntimeConfigContext } from './RuntimeConfigContext'
import { getRuntimeConfig, setRuntimeConfig } from './runtimeConfig'

type RuntimeConfigProviderProps = {
  children: ReactNode
}

/**
 * Подгружает runtime policy-конфиг и делает его доступным всему frontend.
 */
export function RuntimeConfigProvider({ children }: RuntimeConfigProviderProps) {
  const [config, setConfig] = useState<ClientRuntimeConfig>(() => getRuntimeConfig())
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true

    apiService
      .getClientConfig()
      .then((next) => {
        if (!active) return
        setRuntimeConfig(next)
        setConfig(next)
      })
      .catch((err) => {
        debugLog('Client config fetch failed, using defaults', err)
      })
      .finally(() => {
        if (!active) return
        setReady(true)
      })

    return () => {
      active = false
    }
  }, [])

  const value = useMemo(
    () => ({
      config,
      ready,
    }),
    [config, ready],
  )

  return <RuntimeConfigContext.Provider value={value}>{children}</RuntimeConfigContext.Provider>
}
