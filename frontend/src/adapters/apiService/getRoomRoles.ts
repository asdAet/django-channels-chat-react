import type { AxiosInstance } from "axios";

import { decodeRolesListResponse } from "../../dto";
import type { Role } from "../../entities/role/types";

export async function getRoomRoles(
  apiClient: AxiosInstance,
  slug: string,
): Promise<Role[]> {
  const response = await apiClient.get<unknown>(
    `/chat/rooms/${encodeURIComponent(slug)}/roles/`,
  );
  return decodeRolesListResponse(response.data);
}
