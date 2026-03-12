import type { AxiosInstance } from "axios";

export async function revokeInvite(
  apiClient: AxiosInstance,
  slug: string,
  code: string,
): Promise<void> {
  await apiClient.delete(
    `/groups/${encodeURIComponent(slug)}/invites/${encodeURIComponent(code)}/`,
  );
}
