import type { AxiosInstance } from "axios";

import { decodeMyPermissionsResponse } from "../../dto";
import type { MyPermissions } from "../../entities/role/types";

export async function getMyPermissions(
  apiClient: AxiosInstance,
  slug: string,
): Promise<MyPermissions> {
  const response = await apiClient.get<unknown>(
    `/chat/rooms/${encodeURIComponent(slug)}/permissions/me/`,
  );
  return decodeMyPermissionsResponse(response.data);
}
