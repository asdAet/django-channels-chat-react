import type { AxiosInstance } from "axios";

export async function unblockUser(
  apiClient: AxiosInstance,
  userId: number,
): Promise<void> {
  await apiClient.delete(`/friends/block/${userId}/`);
}
