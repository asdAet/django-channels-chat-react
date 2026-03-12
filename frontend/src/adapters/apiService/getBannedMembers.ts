import type { AxiosInstance } from "axios";

import { decodeBannedMembersResponse } from "../../dto";
import type { BannedMember } from "../../entities/group/types";

export type BannedMembersResult = { items: BannedMember[]; total: number };

export async function getBannedMembers(
  apiClient: AxiosInstance,
  slug: string,
): Promise<BannedMembersResult> {
  const response = await apiClient.get<unknown>(
    `/groups/${encodeURIComponent(slug)}/banned/`,
  );
  return decodeBannedMembersResponse(response.data);
}
