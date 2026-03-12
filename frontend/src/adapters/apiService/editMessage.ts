import type { AxiosInstance } from "axios";

import { decodeEditMessageResponse } from "../../dto";
import type { EditMessageResult } from "../../domain/interfaces/IApiService";

export async function editMessage(
  apiClient: AxiosInstance,
  slug: string,
  messageId: number,
  content: string,
): Promise<EditMessageResult> {
  const encodedSlug = encodeURIComponent(slug);
  const response = await apiClient.patch<unknown>(
    `/chat/rooms/${encodedSlug}/messages/${messageId}/`,
    { content },
  );
  return decodeEditMessageResponse(response.data);
}
