import type { AxiosInstance } from "axios";

import { decodeGroupListResponse } from "../../dto";
import type { GroupListItem } from "../../entities/group/types";

export async function getMyGroups(
  apiClient: AxiosInstance,
  params?: { search?: string; page?: number; pageSize?: number },
): Promise<{
  items: GroupListItem[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.set("search", params.search);
  if (typeof params?.page === "number")
    searchParams.set("page", String(params.page));
  if (typeof params?.pageSize === "number")
    searchParams.set("pageSize", String(params.pageSize));
  const query = searchParams.toString();
  const response = await apiClient.get<unknown>(
    `/groups/my/${query ? `?${query}` : ""}`,
  );
  return decodeGroupListResponse(response.data);
}
