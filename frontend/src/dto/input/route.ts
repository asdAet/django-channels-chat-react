import { z } from "zod";

import { getChatRoomSlugRegExp } from "../../shared/config/limits";

const usernameSchema = z
  .string()
  .transform((value) => value.trim())
  .transform((value) => {
    if (!value.startsWith("@")) return value;
    const next = value.slice(1);
    return next.startsWith("@") ? value : next;
  })
  .refine((value) => value.length > 0, "Требуется имя пользователя");

/**
 * Декодирует slug комнаты из route-параметра.
 * @param value Сырое значение из маршрута.
 * @returns Валидный slug или null.
 */
export const decodeRoomSlugParam = (value: unknown): string | null => {
  const roomSlugSchema = z.string().regex(getChatRoomSlugRegExp());
  const parsed = roomSlugSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

/**
 * Декодирует username из route-параметра.
 * @param value Сырое значение из маршрута.
 * @returns Валидный username без префикса @ или null.
 */
export const decodeUsernameParam = (value: unknown): string | null => {
  const parsed = usernameSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};
