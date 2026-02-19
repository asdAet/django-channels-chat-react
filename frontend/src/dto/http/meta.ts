import { z } from 'zod'

import type { ClientRuntimeConfig } from '../../domain/interfaces/IApiService'
import { decodeOrThrow } from '../core/codec'

const mediaModeSchema = z.literal('signed_only')

const clientConfigSchema = z
  .object({
    usernameMaxLength: z.number().int().min(1).max(150),
    chatMessageMaxLength: z.number().int().min(1),
    chatRoomSlugRegex: z.string().min(1),
    mediaUrlTtlSeconds: z.number().int().min(1),
    mediaMode: mediaModeSchema,
  })
  .passthrough()

/**
 * Декодирует payload /api/meta/client-config/.
 */
export const decodeClientConfigResponse = (input: unknown): ClientRuntimeConfig =>
  decodeOrThrow(clientConfigSchema, input, 'meta/client-config')
