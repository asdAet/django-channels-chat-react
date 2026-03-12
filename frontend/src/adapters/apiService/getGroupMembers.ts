import type { AxiosInstance } from "axios";

import { decodeGroupMembersResponse } from "../../dto";
import type { GroupMember } from "../../entities/group/types";

export type GroupMembersResult = { items: GroupMember[]; total: number };

export async function getGroupMembers(
  apiClient: AxiosInstance,
  slug: string,
  params?: { page?: number; pageSize?: number },
): Promise<GroupMembersResult> {
  const response = await apiClient.get<unknown>(
    `/groups/${encodeURIComponent(slug)}/members/`,
    { params },
  );
  return decodeGroupMembersResponse(response.data);
}
