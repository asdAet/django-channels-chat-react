import type { AxiosInstance } from "axios";

import { decodeOverrideResponse } from "../../dto";
import type { PermissionOverride } from "../../entities/role/types";

export async function updateRoomOverride(
  apiClient: AxiosInstance,
  slug: string,
  overrideId: number,
  data: Partial<{ allow: number; deny: number }>,
): Promise<PermissionOverride> {
  const response = await apiClient.patch<unknown>(
    `/chat/rooms/${encodeURIComponent(slug)}/overrides/${overrideId}/`,
    data,
  );
  return decodeOverrideResponse(response.data);
}
