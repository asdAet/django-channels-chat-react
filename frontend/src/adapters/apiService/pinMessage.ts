import type { AxiosInstance } from "axios";

export async function pinMessage(
  apiClient: AxiosInstance,
  slug: string,
  messageId: number,
): Promise<void> {
  await apiClient.post(`/groups/${encodeURIComponent(slug)}/pins/`, {
    messageId,
  });
}
