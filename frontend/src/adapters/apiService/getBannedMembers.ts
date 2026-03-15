import type { AxiosInstance } from "axios";

import { decodeBannedMembersResponse } from "../../dto";
import type { BannedMember } from "../../entities/group/types";

export type BannedMembersResult = {
  items: BannedMember[];
  total: number;
  pagination: {
    limit: number;
    hasMore: boolean;
    nextBefore: number | null;
  };
};

export async function getBannedMembers(
  apiClient: AxiosInstance,
  slug: string,
  params?: { limit?: number; before?: number },
): Promise<BannedMembersResult> {
  const response = await apiClient.get<unknown>(
    `/groups/${encodeURIComponent(slug)}/banned/`,
    { params },
  );
  return decodeBannedMembersResponse(response.data);
}
