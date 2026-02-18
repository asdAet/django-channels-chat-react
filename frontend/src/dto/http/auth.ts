import { z } from 'zod'

import type { UserProfile } from '../../entities/user/types'
import { decodeOrThrow, safeDecode } from '../core/codec'

const rawUserProfileSchema = z
  .object({
    username: z.string().min(1),
    email: z.string().optional(),
    profileImage: z.string().nullable().optional(),
    bio: z.string().optional(),
    lastSeen: z.string().nullable().optional(),
    registeredAt: z.string().nullable().optional(),
  })
  .passthrough()

const sessionResponseSchema = z
  .object({
    authenticated: z.boolean(),
    user: rawUserProfileSchema.nullable(),
  })
  .passthrough()

const csrfSchema = z.object({ csrfToken: z.string() }).passthrough()

const presenceSessionSchema = z.object({ ok: z.boolean() }).passthrough()

const passwordRulesSchema = z.object({ rules: z.array(z.string()) }).passthrough()

const logoutSchema = z.object({ ok: z.boolean() }).passthrough()

const profileEnvelopeSchema = z
  .object({
    user: rawUserProfileSchema,
  })
  .passthrough()

const errorPayloadSchema = z
  .object({
    error: z.string().optional(),
    detail: z.string().optional(),
    errors: z.record(z.string(), z.union([z.string(), z.array(z.string())])).optional(),
  })
  .passthrough()

const loginRequestSchema = z
  .object({
    username: z.string().trim().min(1),
    password: z.string().min(1),
  })
  .strict()

const registerRequestSchema = z
  .object({
    username: z.string().trim().min(1),
    password1: z.string().min(1),
    password2: z.string().min(1),
  })
  .strict()

const maybeFileSchema = z.custom<File | null | undefined>(
  (value) => {
    if (value === null || value === undefined) return true
    if (typeof File === 'undefined') return true
    return value instanceof File
  },
  { message: 'Expected File' },
)

const updateProfileRequestSchema = z
  .object({
    username: z.string().trim().min(1),
    email: z.string(),
    image: maybeFileSchema.optional(),
    bio: z.string().optional(),
  })
  .strict()

const mapUserProfile = (dto: z.infer<typeof rawUserProfileSchema>): UserProfile => ({
  username: dto.username,
  email: dto.email ?? '',
  profileImage: dto.profileImage ?? null,
  bio: dto.bio ?? '',
  lastSeen: dto.lastSeen ?? null,
  registeredAt: dto.registeredAt ?? null,
})

export type SessionResponseDto = {
  authenticated: boolean
  user: UserProfile | null
}

export type ProfileEnvelopeDto = {
  user: UserProfile
}

export type AuthErrorPayloadDto = z.infer<typeof errorPayloadSchema>

export type LoginRequestDto = z.infer<typeof loginRequestSchema>
export type RegisterRequestDto = z.infer<typeof registerRequestSchema>
export type UpdateProfileRequestDto = z.infer<typeof updateProfileRequestSchema>

/**
 * Декодирует payload /api/auth/csrf/.
 */
export const decodeCsrfResponse = (input: unknown) => decodeOrThrow(csrfSchema, input, 'auth/csrf')

/**
 * Декодирует payload /api/auth/presence-session/.
 */
export const decodePresenceSessionResponse = (input: unknown) =>
  decodeOrThrow(presenceSessionSchema, input, 'auth/presence-session')

/**
 * Декодирует payload /api/auth/password-rules/.
 */
export const decodePasswordRulesResponse = (input: unknown) =>
  decodeOrThrow(passwordRulesSchema, input, 'auth/password-rules')

/**
 * Декодирует payload /api/auth/logout/.
 */
export const decodeLogoutResponse = (input: unknown) => decodeOrThrow(logoutSchema, input, 'auth/logout')

/**
 * Декодирует payload /api/auth/session|login|register/.
 */
export const decodeSessionResponse = (input: unknown): SessionResponseDto => {
  const parsed = decodeOrThrow(sessionResponseSchema, input, 'auth/session')
  return {
    authenticated: parsed.authenticated,
    user: parsed.user ? mapUserProfile(parsed.user) : null,
  }
}

/**
 * Декодирует payload /api/auth/profile/ и /api/auth/users/:username/.
 */
export const decodeProfileEnvelopeResponse = (input: unknown): ProfileEnvelopeDto => {
  const parsed = decodeOrThrow(profileEnvelopeSchema, input, 'auth/profile-envelope')
  return { user: mapUserProfile(parsed.user) }
}

/**
 * Пытается декодировать payload ошибок auth-endpoint.
 */
export const decodeAuthErrorPayload = (input: unknown): AuthErrorPayloadDto | null =>
  safeDecode(errorPayloadSchema, input)

/**
 * Валидирует login DTO перед отправкой.
 */
export const buildLoginRequestDto = (input: unknown): LoginRequestDto =>
  decodeOrThrow(loginRequestSchema, input, 'auth/login-request')

/**
 * Валидирует register DTO перед отправкой.
 */
export const buildRegisterRequestDto = (input: unknown): RegisterRequestDto =>
  decodeOrThrow(registerRequestSchema, input, 'auth/register-request')

/**
 * Валидирует update-profile DTO перед отправкой.
 */
export const buildUpdateProfileRequestDto = (input: unknown): UpdateProfileRequestDto =>
  decodeOrThrow(updateProfileRequestSchema, input, 'auth/update-profile-request')
