import type { AxiosInstance } from "axios";

import { decodeMemberRolesResponse } from "../../dto";
import type { MemberRoles } from "../../entities/role/types";

export async function getMemberRoles(
  apiClient: AxiosInstance,
  slug: string,
  userId: number,
): Promise<MemberRoles> {
  const response = await apiClient.get<unknown>(
    `/chat/rooms/${encodeURIComponent(slug)}/members/${userId}/roles/`,
  );
  return decodeMemberRolesResponse(response.data);
}
