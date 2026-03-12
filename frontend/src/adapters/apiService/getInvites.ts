import type { AxiosInstance } from "axios";

import { decodeInvitesResponse } from "../../dto";
import type { GroupInvite } from "../../entities/group/types";

export async function getInvites(
  apiClient: AxiosInstance,
  slug: string,
): Promise<GroupInvite[]> {
  const response = await apiClient.get<unknown>(
    `/groups/${encodeURIComponent(slug)}/invites/`,
  );
  return decodeInvitesResponse(response.data);
}
