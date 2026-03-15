import type { AxiosInstance } from "axios";

import { decodeGroupMembersResponse } from "../../dto";
import type { GroupMember } from "../../entities/group/types";

export type GroupMembersResult = {
  items: GroupMember[];
  total: number;
  pagination: {
    limit: number;
    hasMore: boolean;
    nextBefore: number | null;
  };
};

export async function getGroupMembers(
  apiClient: AxiosInstance,
  slug: string,
  params?: { limit?: number; before?: number },
): Promise<GroupMembersResult> {
  const response = await apiClient.get<unknown>(
    `/groups/${encodeURIComponent(slug)}/members/`,
    { params },
  );
  return decodeGroupMembersResponse(response.data);
}
