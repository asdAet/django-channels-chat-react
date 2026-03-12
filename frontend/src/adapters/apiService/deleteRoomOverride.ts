import type { AxiosInstance } from "axios";

export async function deleteRoomOverride(
  apiClient: AxiosInstance,
  slug: string,
  overrideId: number,
): Promise<void> {
  await apiClient.delete(
    `/chat/rooms/${encodeURIComponent(slug)}/overrides/${overrideId}/`,
  );
}
