import type { AxiosInstance } from "axios";

import { decodeRoleResponse } from "../../dto";
import type { Role } from "../../entities/role/types";

export async function createRoomRole(
  apiClient: AxiosInstance,
  slug: string,
  data: { name: string; color?: string; permissions?: number },
): Promise<Role> {
  const response = await apiClient.post<unknown>(
    `/chat/rooms/${encodeURIComponent(slug)}/roles/`,
    data,
  );
  return decodeRoleResponse(response.data);
}
