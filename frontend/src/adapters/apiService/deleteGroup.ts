import type { AxiosInstance } from "axios";

export async function deleteGroup(
  apiClient: AxiosInstance,
  slug: string,
): Promise<void> {
  await apiClient.delete(`/groups/${encodeURIComponent(slug)}/`);
}
