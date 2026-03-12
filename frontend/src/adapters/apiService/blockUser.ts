import type { AxiosInstance } from "axios";

export async function blockUser(
  apiClient: AxiosInstance,
  username: string,
): Promise<void> {
  await apiClient.post("/friends/block/", { username });
}
