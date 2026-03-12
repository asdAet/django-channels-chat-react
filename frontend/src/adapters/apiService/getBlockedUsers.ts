import type { AxiosInstance } from "axios";

import type { BlockedUser } from "../../entities/friend/types";
import { decodeBlockedListResponse } from "../../dto/http/friends";

export async function getBlockedUsers(
  apiClient: AxiosInstance,
): Promise<BlockedUser[]> {
  const response = await apiClient.get("/friends/blocked/");
  return decodeBlockedListResponse(response.data);
}
