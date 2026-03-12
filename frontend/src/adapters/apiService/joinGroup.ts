import type { AxiosInstance } from "axios";

export async function joinGroup(
  apiClient: AxiosInstance,
  slug: string,
): Promise<void> {
  await apiClient.post(`/groups/${encodeURIComponent(slug)}/join/`);
}
