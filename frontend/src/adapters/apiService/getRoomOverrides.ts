import type { AxiosInstance } from "axios";

import { decodeOverridesResponse } from "../../dto";
import type { PermissionOverride } from "../../entities/role/types";

export async function getRoomOverrides(
  apiClient: AxiosInstance,
  slug: string,
): Promise<PermissionOverride[]> {
  const response = await apiClient.get<unknown>(
    `/chat/rooms/${encodeURIComponent(slug)}/overrides/`,
  );
  return decodeOverridesResponse(response.data);
}
