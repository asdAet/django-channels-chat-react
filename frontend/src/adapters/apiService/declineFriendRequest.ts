import type { AxiosInstance } from "axios";

export async function declineFriendRequest(
  apiClient: AxiosInstance,
  friendshipId: number,
): Promise<void> {
  await apiClient.post(`/friends/requests/${friendshipId}/decline/`);
}
