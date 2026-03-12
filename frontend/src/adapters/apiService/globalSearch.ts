import type { AxiosInstance } from "axios";

import { decodeGlobalSearchResponse } from "../../dto";
import type { GlobalSearchResult } from "../../domain/interfaces/IApiService";

export async function globalSearch(
  apiClient: AxiosInstance,
  query: string,
  params?: {
    usersLimit?: number;
    groupsLimit?: number;
    messagesLimit?: number;
  },
): Promise<GlobalSearchResult> {
  const searchParams = new URLSearchParams();
  searchParams.set("q", query);
  if (typeof params?.usersLimit === "number")
    searchParams.set("usersLimit", String(params.usersLimit));
  if (typeof params?.groupsLimit === "number")
    searchParams.set("groupsLimit", String(params.groupsLimit));
  if (typeof params?.messagesLimit === "number")
    searchParams.set("messagesLimit", String(params.messagesLimit));
  const response = await apiClient.get<unknown>(
    `/chat/search/global/?${searchParams.toString()}`,
  );
  return decodeGlobalSearchResponse(response.data);
}
