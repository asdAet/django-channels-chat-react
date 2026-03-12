import type { AxiosInstance } from "axios";

export async function removeReaction(
  apiClient: AxiosInstance,
  slug: string,
  messageId: number,
  emoji: string,
): Promise<void> {
  const encodedSlug = encodeURIComponent(slug);
  await apiClient.delete(
    `/chat/rooms/${encodedSlug}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/`,
  );
}
