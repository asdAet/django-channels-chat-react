import type { AxiosInstance } from "axios";

export async function acceptFriendRequest(
  apiClient: AxiosInstance,
  friendshipId: number,
): Promise<void> {
  await apiClient.post(`/friends/requests/${friendshipId}/accept/`);
}
