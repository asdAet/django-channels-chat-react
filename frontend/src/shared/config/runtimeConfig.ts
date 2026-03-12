import type { ClientRuntimeConfig } from "../../domain/interfaces/IApiService";

export const DEFAULT_RUNTIME_CONFIG: ClientRuntimeConfig = {
  usernameMaxLength: 30,
  chatMessageMaxLength: 1000,
  chatRoomSlugRegex: "^[A-Za-z0-9_-]{3,50}$",
  chatAttachmentMaxSizeMb: 10,
  chatAttachmentMaxPerMessage: 5,
  chatAttachmentAllowedTypes: [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
    "text/plain",
    "video/mp4",
    "audio/mp3",
    "audio/mpeg",
    "audio/webm",
  ],
  mediaUrlTtlSeconds: 300,
  mediaMode: "signed_only",
};

let currentRuntimeConfig: ClientRuntimeConfig = { ...DEFAULT_RUNTIME_CONFIG };

/**
 * Возвращает актуальный runtime-конфиг клиента.
 */
export const getRuntimeConfig = (): ClientRuntimeConfig => currentRuntimeConfig;

/**
 * Обновляет runtime-конфиг клиента значениями с backend.
 */
export const setRuntimeConfig = (next: ClientRuntimeConfig): void => {
  currentRuntimeConfig = { ...next };
};
