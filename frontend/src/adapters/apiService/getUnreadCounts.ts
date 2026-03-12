import type { AxiosInstance } from "axios";

import { decodeUnreadCountsResponse } from "../../dto";
import type { UnreadCountItem } from "../../domain/interfaces/IApiService";

export async function getUnreadCounts(
  apiClient: AxiosInstance,
): Promise<UnreadCountItem[]> {
  const response = await apiClient.get<unknown>("/chat/rooms/unread/");
  return decodeUnreadCountsResponse(response.data);
}
