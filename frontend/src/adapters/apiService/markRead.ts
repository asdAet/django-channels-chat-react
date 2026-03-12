import type { AxiosInstance } from "axios";

import { decodeReadStateResponse } from "../../dto";
import type { ReadStateResult } from "../../domain/interfaces/IApiService";

export async function markRead(
  apiClient: AxiosInstance,
  slug: string,
  messageId?: number,
): Promise<ReadStateResult> {
  const encodedSlug = encodeURIComponent(slug);
  const body = messageId ? { lastReadMessageId: messageId } : {};
  const response = await apiClient.post<unknown>(
    `/chat/rooms/${encodedSlug}/read/`,
    body,
  );
  return decodeReadStateResponse(response.data);
}
