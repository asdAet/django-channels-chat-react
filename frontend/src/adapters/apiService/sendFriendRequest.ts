import type { AxiosInstance } from "axios";

import { decodeSendFriendRequestResponse } from "../../dto";
import type { SendFriendRequestResponse } from "../../dto/http/friends";

export async function sendFriendRequest(
  apiClient: AxiosInstance,
  username: string,
): Promise<SendFriendRequestResponse> {
  const response = await apiClient.post<unknown>("/friends/requests/", {
    username,
  });
  return decodeSendFriendRequestResponse(response.data);
}
