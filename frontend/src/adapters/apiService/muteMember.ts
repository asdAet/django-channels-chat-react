import type { AxiosInstance } from "axios";

export async function muteMember(
  apiClient: AxiosInstance,
  slug: string,
  userId: number,
  durationSeconds = 3600,
): Promise<void> {
  await apiClient.post(
    `/groups/${encodeURIComponent(slug)}/members/${userId}/mute/`,
    { durationSeconds },
  );
}
