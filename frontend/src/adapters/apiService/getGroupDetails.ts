import type { AxiosInstance } from "axios";

import { decodeGroupResponse } from "../../dto";
import type { Group } from "../../entities/group/types";

export async function getGroupDetails(
  apiClient: AxiosInstance,
  slug: string,
): Promise<Group> {
  const response = await apiClient.get<unknown>(
    `/groups/${encodeURIComponent(slug)}/`,
  );
  return decodeGroupResponse(response.data);
}
