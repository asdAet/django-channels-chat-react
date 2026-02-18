export type ApiError = {
  status: number
  message: string
  data?: Record<string, unknown>
}
