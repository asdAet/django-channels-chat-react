import type { AxiosInstance } from "axios";

export async function transferOwnership(
  apiClient: AxiosInstance,
  slug: string,
  userId: number,
): Promise<void> {
  await apiClient.post(
    `/groups/${encodeURIComponent(slug)}/transfer-ownership/`,
    { userId },
  );
}
