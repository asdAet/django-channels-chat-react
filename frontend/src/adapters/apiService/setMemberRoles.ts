import type { AxiosInstance } from "axios";

import { decodeMemberRolesResponse } from "../../dto";
import type { MemberRoles } from "../../entities/role/types";

export async function setMemberRoles(
  apiClient: AxiosInstance,
  slug: string,
  userId: number,
  roleIds: number[],
): Promise<MemberRoles> {
  const response = await apiClient.patch<unknown>(
    `/chat/rooms/${encodeURIComponent(slug)}/members/${userId}/roles/`,
    { roleIds },
  );
  return decodeMemberRolesResponse(response.data);
}
