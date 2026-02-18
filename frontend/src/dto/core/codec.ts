import { z } from 'zod'

import { DtoDecodeError } from './errors'

const formatPath = (path: PropertyKey[]) => (path.length ? path.map(String).join('.') : '<root>')

const formatIssues = (error: z.ZodError): string[] =>
  error.issues.map((issue) => `${formatPath(issue.path)}: ${issue.message}`)

/**
 * Проверяет входное значение по схеме и бросает DtoDecodeError при невалидном payload.
 * @param schema Zod-схема внешнего контракта.
 * @param input Входное внешнее значение.
 * @param source Идентификатор источника (endpoint/event key).
 * @returns Валидированные и типизированные данные.
 */
export const decodeOrThrow = <TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: unknown,
  source: string,
): z.infer<TSchema> => {
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    throw new DtoDecodeError(source, formatIssues(parsed.error))
  }
  return parsed.data
}

/**
 * Проверяет входное значение по схеме без броска исключения.
 * @param schema Zod-схема внешнего контракта.
 * @param input Входное внешнее значение.
 * @returns Валидированное значение или null.
 */
export const safeDecode = <TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: unknown,
): z.infer<TSchema> | null => {
  const parsed = schema.safeParse(input)
  return parsed.success ? parsed.data : null
}

/**
 * Разбирает JSON-строку в unknown-объект без падения.
 * @param raw Сырой JSON payload.
 * @returns Разобранное значение или null.
 */
export const parseJson = (raw: string): unknown | null => {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}
