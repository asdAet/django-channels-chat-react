import type { AxiosInstance } from "axios";

export async function kickMember(
  apiClient: AxiosInstance,
  slug: string,
  userId: number,
): Promise<void> {
  await apiClient.delete(
    `/groups/${encodeURIComponent(slug)}/members/${userId}/`,
  );
}
