import type { AxiosInstance } from "axios";

export async function rejectJoinRequest(
  apiClient: AxiosInstance,
  slug: string,
  requestId: number,
): Promise<void> {
  await apiClient.post(
    `/groups/${encodeURIComponent(slug)}/requests/${requestId}/reject/`,
  );
}
