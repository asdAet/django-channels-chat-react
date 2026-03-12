import type { AxiosInstance } from "axios";

export async function removeFriend(
  apiClient: AxiosInstance,
  userId: number,
): Promise<void> {
  await apiClient.delete(`/friends/${userId}/`);
}
