import type { AxiosInstance } from "axios";

import { decodeOutgoingRequestsResponse } from "../../dto";
import type { FriendRequest } from "../../entities/friend/types";

export async function getOutgoingRequests(
  apiClient: AxiosInstance,
): Promise<FriendRequest[]> {
  const response = await apiClient.get<unknown>("/friends/requests/outgoing/");
  return decodeOutgoingRequestsResponse(response.data);
}
