import type { AxiosInstance } from "axios";

export async function banMember(
  apiClient: AxiosInstance,
  slug: string,
  userId: number,
  reason?: string,
): Promise<void> {
  await apiClient.post(
    `/groups/${encodeURIComponent(slug)}/members/${userId}/ban/`,
    reason ? { reason } : {},
  );
}
