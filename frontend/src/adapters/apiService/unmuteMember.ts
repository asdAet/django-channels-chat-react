import type { AxiosInstance } from "axios";

export async function unmuteMember(
  apiClient: AxiosInstance,
  slug: string,
  userId: number,
): Promise<void> {
  await apiClient.post(
    `/groups/${encodeURIComponent(slug)}/members/${userId}/unmute/`,
  );
}
