import type { AxiosInstance } from "axios";

export async function joinViaInvite(
  apiClient: AxiosInstance,
  code: string,
): Promise<{ slug: string }> {
  const response = await apiClient.post<{ slug?: string }>(
    `/invite/${encodeURIComponent(code)}/join/`,
  );
  return {
    slug: ((response.data as Record<string, unknown>).slug as string) ?? "",
  };
}
