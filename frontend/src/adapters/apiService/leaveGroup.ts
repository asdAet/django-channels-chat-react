import type { AxiosInstance } from "axios";

export async function leaveGroup(
  apiClient: AxiosInstance,
  slug: string,
): Promise<void> {
  await apiClient.post(`/groups/${encodeURIComponent(slug)}/leave/`);
}
