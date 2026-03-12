import type { AxiosInstance } from "axios";

import { decodeInviteResponse } from "../../dto";
import type { GroupInvite } from "../../entities/group/types";

export async function createInvite(
  apiClient: AxiosInstance,
  slug: string,
  data?: { maxUses?: number; expiresInHours?: number },
): Promise<GroupInvite> {
  const payload = {
    maxUses: data?.maxUses ?? 0,
    expiresInSeconds:
      typeof data?.expiresInHours === "number" && data.expiresInHours > 0
        ? Math.floor(data.expiresInHours * 3600)
        : undefined,
  };
  const response = await apiClient.post<unknown>(
    `/groups/${encodeURIComponent(slug)}/invites/`,
    payload,
  );
  return decodeInviteResponse(response.data);
}
