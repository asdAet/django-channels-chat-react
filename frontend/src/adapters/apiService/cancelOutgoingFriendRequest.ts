import type { AxiosInstance } from "axios";

export async function cancelOutgoingFriendRequest(
  apiClient: AxiosInstance,
  friendshipId: number,
): Promise<void> {
  await apiClient.delete(`/friends/requests/${friendshipId}/cancel/`);
}
