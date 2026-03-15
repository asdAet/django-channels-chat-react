import type { AxiosInstance } from "axios";

import { decodeGroupListResponse } from "../../dto";
import type { GroupListItem } from "../../entities/group/types";

export async function getMyGroups(
  apiClient: AxiosInstance,
  params?: { search?: string; limit?: number; before?: number },
): Promise<{
  items: GroupListItem[];
  total: number;
  pagination: {
    limit: number;
    hasMore: boolean;
    nextBefore: number | null;
  };
}> {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.set("search", params.search);
  if (typeof params?.limit === "number")
    searchParams.set("limit", String(params.limit));
  if (typeof params?.before === "number")
    searchParams.set("before", String(params.before));
  const query = searchParams.toString();
  const response = await apiClient.get<unknown>(
    `/groups/my/${query ? `?${query}` : ""}`,
  );
  return decodeGroupListResponse(response.data);
}
