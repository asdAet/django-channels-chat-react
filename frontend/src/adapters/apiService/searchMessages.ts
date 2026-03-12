import type { AxiosInstance } from "axios";

import { decodeSearchResponse } from "../../dto";
import type { SearchResult } from "../../domain/interfaces/IApiService";

export async function searchMessages(
  apiClient: AxiosInstance,
  slug: string,
  query: string,
): Promise<SearchResult> {
  const encodedSlug = encodeURIComponent(slug);
  const response = await apiClient.get<unknown>(
    `/chat/rooms/${encodedSlug}/messages/search/?q=${encodeURIComponent(query)}`,
  );
  return decodeSearchResponse(response.data);
}
