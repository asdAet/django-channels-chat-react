import type { AxiosInstance } from "axios";

import { decodeJoinRequestsResponse } from "../../dto";
import type { JoinRequest } from "../../entities/group/types";

export async function getJoinRequests(
  apiClient: AxiosInstance,
  slug: string,
): Promise<JoinRequest[]> {
  const response = await apiClient.get<unknown>(
    `/groups/${encodeURIComponent(slug)}/requests/`,
  );
  return decodeJoinRequestsResponse(response.data);
}
