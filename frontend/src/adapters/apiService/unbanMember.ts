import type { AxiosInstance } from "axios";

export async function unbanMember(
  apiClient: AxiosInstance,
  slug: string,
  userId: number,
): Promise<void> {
  await apiClient.post(
    `/groups/${encodeURIComponent(slug)}/members/${userId}/unban/`,
  );
}
