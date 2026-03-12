import type { AxiosInstance } from "axios";

import { decodeGroupResponse } from "../../dto";
import type { Group } from "../../entities/group/types";

export async function createGroup(
  apiClient: AxiosInstance,
  data: {
    name: string;
    description?: string;
    isPublic?: boolean;
    username?: string | null;
  },
): Promise<Group> {
  const response = await apiClient.post<unknown>("/groups/", data);
  return decodeGroupResponse(response.data);
}
