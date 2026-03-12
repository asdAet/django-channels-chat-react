import type { AxiosInstance } from "axios";

import { decodeRoomAttachmentsResponse } from "../../dto";
import type { RoomAttachmentsResult } from "../../domain/interfaces/IApiService";

export async function getRoomAttachments(
  apiClient: AxiosInstance,
  slug: string,
  params?: { limit?: number; before?: number },
): Promise<RoomAttachmentsResult> {
  const encodedSlug = encodeURIComponent(slug);
  const searchParams = new URLSearchParams();
  if (typeof params?.limit === "number")
    searchParams.set("limit", String(params.limit));
  if (typeof params?.before === "number")
    searchParams.set("before", String(params.before));
  const query = searchParams.toString();
  const response = await apiClient.get<unknown>(
    `/chat/rooms/${encodedSlug}/attachments/${query ? `?${query}` : ""}`,
  );
  return decodeRoomAttachmentsResponse(response.data);
}
