import type { AxiosInstance } from "axios";

import { decodeGroupListResponse } from "../../dto";
import type { GroupListItem } from "../../entities/group/types";

export type PublicGroupsParams = {
  search?: string;
  page?: number;
  pageSize?: number;
};

export type PublicGroupsResult = {
  items: GroupListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export async function getPublicGroups(
  apiClient: AxiosInstance,
  params?: PublicGroupsParams,
): Promise<PublicGroupsResult> {
  const response = await apiClient.get<unknown>("/groups/public/", { params });
  return decodeGroupListResponse(response.data);
}
