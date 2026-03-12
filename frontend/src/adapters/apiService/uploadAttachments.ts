import type { AxiosInstance } from "axios";

import { decodeUploadResponse } from "../../dto";
import type {
  UploadAttachmentsOptions,
  UploadResult,
} from "../../domain/interfaces/IApiService";

export async function uploadAttachments(
  apiClient: AxiosInstance,
  slug: string,
  files: File[],
  options?: UploadAttachmentsOptions,
): Promise<UploadResult> {
  const encodedSlug = encodeURIComponent(slug);
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }
  if (typeof options?.messageContent === "string") {
    formData.append("messageContent", options.messageContent);
  }
  if (typeof options?.replyTo === "number") {
    formData.append("replyTo", String(options.replyTo));
  }
  const response = await apiClient.post<unknown>(
    `/chat/rooms/${encodedSlug}/attachments/`,
    formData,
    options?.onProgress
      ? {
          onUploadProgress: (event) => {
            if (event.total) {
              options.onProgress?.(
                Math.round((event.loaded / event.total) * 100),
              );
            }
          },
          signal: options.signal,
        }
      : { signal: options?.signal },
  );
  return decodeUploadResponse(response.data);
}
