import { useRuntimeConfig } from "./RuntimeConfigContext";
import { getRuntimeConfig } from "./runtimeConfig";

const DEFAULT_ROOM_SLUG_REGEX = "^[A-Za-z0-9_-]{3,50}$";

/**
 * Возвращает ограничение длины username из backend policy.
 */
export const getUsernameMaxLength = () => getRuntimeConfig().usernameMaxLength;

/**
 * Хук доступа к ограничению длины username из runtime policy.
 */
export const useUsernameMaxLength = () =>
  useRuntimeConfig().config.usernameMaxLength;

/**
 * Возвращает ограничение длины сообщения из runtime policy.
 */
export const getChatMessageMaxLength = () =>
  getRuntimeConfig().chatMessageMaxLength;

/**
 * Хук доступа к ограничению длины сообщения из runtime policy.
 */
export const useChatMessageMaxLength = () =>
  useRuntimeConfig().config.chatMessageMaxLength;

/**
 * Возвращает максимальный размер одного вложения в МБ из runtime policy.
 */
export const getChatAttachmentMaxSizeMb = () =>
  getRuntimeConfig().chatAttachmentMaxSizeMb;

/**
 * Возвращает максимальный размер одного вложения в байтах из runtime policy.
 */
export const getChatAttachmentMaxSizeBytes = () =>
  getChatAttachmentMaxSizeMb() * 1024 * 1024;

/**
 * Хук доступа к лимиту размера одного вложения (в МБ).
 */
export const useChatAttachmentMaxSizeMb = () =>
  useRuntimeConfig().config.chatAttachmentMaxSizeMb;

/**
 * Хук доступа к лимиту количества вложений на сообщение.
 */
export const useChatAttachmentMaxPerMessage = () =>
  useRuntimeConfig().config.chatAttachmentMaxPerMessage;

/**
 * Хук доступа к списку разрешенных MIME-типов вложений.
 */
export const useChatAttachmentAllowedTypes = () =>
  useRuntimeConfig().config.chatAttachmentAllowedTypes;

/**
 * Возвращает строковое regex-правило для slug комнаты.
 */
export const getChatRoomSlugRegex = () => {
  const fromBackend = getRuntimeConfig().chatRoomSlugRegex;
  return fromBackend && fromBackend.trim()
    ? fromBackend
    : DEFAULT_ROOM_SLUG_REGEX;
};

/**
 * Возвращает RegExp для валидации slug комнаты с безопасным fallback.
 */
export const getChatRoomSlugRegExp = () => {
  try {
    return new RegExp(getChatRoomSlugRegex());
  } catch {
    return new RegExp(DEFAULT_ROOM_SLUG_REGEX);
  }
};
