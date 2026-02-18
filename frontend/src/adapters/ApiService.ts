import axios, { AxiosHeaders } from 'axios'
import type { AxiosError, AxiosInstance } from 'axios'

import type { ApiError } from '../shared/api/types'
import { decodeAuthErrorPayload } from '../dto'
import { parseJson, DtoDecodeError } from '../dto'
import {
  readCsrfFromCookie,
  readCsrfFromSessionStorage,
  writeCsrfToSessionStorage,
} from '../dto'
import type { IApiService, UpdateProfileInput } from '../domain/interfaces/IApiService'

import { ensureCsrf as ensureCsrfRequest } from './apiService/ensureCsrf'
import { ensurePresenceSession } from './apiService/ensurePresenceSession'
import { getSession } from './apiService/getSession'
import { login } from './apiService/login'
import { register } from './apiService/register'
import { logout } from './apiService/logout'
import { updateProfile } from './apiService/updateProfile'
import { getPasswordRules } from './apiService/getPasswordRules'
import { getPublicRoom } from './apiService/getPublicRoom'
import { getRoomDetails } from './apiService/getRoomDetails'
import { getRoomMessages } from './apiService/getRoomMessages'
import { getUserProfile } from './apiService/getUserProfile'
import { startDirectChat } from './apiService/startDirectChat'
import { getDirectChats } from './apiService/getDirectChats'

const API_BASE = '/api'
const CSRF_STORAGE_KEY = 'csrfToken'

const getCsrfToken = () => readCsrfFromCookie() || readCsrfFromSessionStorage(CSRF_STORAGE_KEY)

const normalizeErrorPayload = (payload: unknown): Record<string, unknown> | undefined => {
  if (!payload) return undefined

  if (typeof payload === 'string') {
    const parsed = parseJson(payload)
    if (parsed && typeof parsed === 'object') {
      const typed = decodeAuthErrorPayload(parsed)
      return (typed as Record<string, unknown>) ?? (parsed as Record<string, unknown>)
    }
    return { detail: payload }
  }

  if (typeof payload === 'object') {
    const typed = decodeAuthErrorPayload(payload)
    return (typed as Record<string, unknown>) ?? (payload as Record<string, unknown>)
  }

  return undefined
}

const extractErrorMessage = (data?: Record<string, unknown>): string | undefined => {
  if (!data) return undefined

  const typed = decodeAuthErrorPayload(data)
  if (typed?.errors) {
    const values = Object.values(typed.errors)
      .flatMap((value) => (Array.isArray(value) ? value : [value]))
      .filter((value) => typeof value === 'string')
    if (values.length) {
      return values.join(' ')
    }
  }

  if (typed?.error) return typed.error
  if (typed?.detail) return typed.detail

  return undefined
}

export const normalizeAxiosError = (error: unknown): ApiError => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError
    const status = axiosError.response?.status ?? 0
    const data = normalizeErrorPayload(axiosError.response?.data)
    const message = extractErrorMessage(data) || axiosError.message || 'Request failed'
    return { status, message, data }
  }

  if (error && typeof error === 'object' && 'status' in error && 'message' in error) {
    return error as ApiError
  }

  if (error instanceof DtoDecodeError) {
    return {
      status: 502,
      message: 'Некорректный ответ сервера',
      data: {
        source: error.source,
        issues: error.issues,
      },
    }
  }

  return { status: 0, message: 'Request failed' }
}

class ApiService implements IApiService {
  private apiClient: AxiosInstance

  public constructor() {
    this.apiClient = axios.create({
      baseURL: API_BASE,
      timeout: 10000,
      withCredentials: true,
    })

    this.apiClient.interceptors.request.use((config) => {
      const method = (config.method || 'get').toLowerCase()
      const headers = AxiosHeaders.from(config.headers)
      const hasBody = method !== 'get' && method !== 'head' && method !== 'options'
      const isFormData = typeof FormData !== 'undefined' && config.data instanceof FormData

      if (hasBody && !isFormData && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json')
      }

      if (hasBody && !headers.has('X-CSRFToken')) {
        const csrf = getCsrfToken()
        if (csrf) {
          headers.set('X-CSRFToken', csrf)
        }
      }

      if (isFormData) {
        headers.delete('Content-Type')
      }

      config.headers = headers
      return config
    })

    this.apiClient.interceptors.response.use(
      (response) => response,
      (error) => Promise.reject(normalizeAxiosError(error)),
    )
  }

  private async runWithDecode<T>(task: () => Promise<T>): Promise<T> {
    try {
      return await task()
    } catch (error) {
      throw normalizeAxiosError(error)
    }
  }

  public async ensureCsrf(): Promise<{ csrfToken: string }> {
    return this.runWithDecode(async () => {
      const data = await ensureCsrfRequest(this.apiClient)
      writeCsrfToSessionStorage(CSRF_STORAGE_KEY, data.csrfToken || null)
      return data
    })
  }

  public async ensurePresenceSession(): Promise<{ ok: boolean }> {
    return this.runWithDecode(async () => ensurePresenceSession(this.apiClient))
  }

  public async getSession() {
    return this.runWithDecode(async () => getSession(this.apiClient))
  }

  public async login(username: string, password: string) {
    return this.runWithDecode(async () => login(this.apiClient, username, password))
  }

  public async register(username: string, password1: string, password2: string) {
    return this.runWithDecode(async () => register(this.apiClient, username, password1, password2))
  }

  public async getPasswordRules() {
    return this.runWithDecode(async () => getPasswordRules(this.apiClient))
  }

  public async logout() {
    return this.runWithDecode(async () => logout(this.apiClient))
  }

  public async updateProfile(fields: UpdateProfileInput) {
    return this.runWithDecode(async () => updateProfile(this.apiClient, fields))
  }

  public async getPublicRoom() {
    return this.runWithDecode(async () => getPublicRoom(this.apiClient))
  }

  public async getRoomDetails(slug: string) {
    return this.runWithDecode(async () => getRoomDetails(this.apiClient, slug))
  }

  public async getRoomMessages(slug: string, params?: { limit?: number; beforeId?: number }) {
    return this.runWithDecode(async () => getRoomMessages(this.apiClient, slug, params))
  }

  public async startDirectChat(username: string) {
    return this.runWithDecode(async () => startDirectChat(this.apiClient, username))
  }

  public async getDirectChats() {
    return this.runWithDecode(async () => getDirectChats(this.apiClient))
  }

  public async getUserProfile(username: string) {
    return this.runWithDecode(async () => getUserProfile(this.apiClient, username))
  }
}

export const apiService = new ApiService()

