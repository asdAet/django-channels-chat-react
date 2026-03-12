import type { AxiosInstance } from "axios";

export async function unpinMessage(
  apiClient: AxiosInstance,
  slug: string,
  messageId: number,
): Promise<void> {
  await apiClient.delete(
    `/groups/${encodeURIComponent(slug)}/pins/${messageId}/`,
  );
}
