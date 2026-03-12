import type { AxiosInstance } from "axios";

export async function deleteMessage(
  apiClient: AxiosInstance,
  slug: string,
  messageId: number,
): Promise<void> {
  const encodedSlug = encodeURIComponent(slug);
  await apiClient.delete(`/chat/rooms/${encodedSlug}/messages/${messageId}/`);
}
