import type { AxiosInstance } from "axios";

import { decodeFriendsListResponse } from "../../dto";
import type { Friend } from "../../entities/friend/types";

export async function getFriends(apiClient: AxiosInstance): Promise<Friend[]> {
  const response = await apiClient.get<unknown>("/friends/");
  return decodeFriendsListResponse(response.data);
}
