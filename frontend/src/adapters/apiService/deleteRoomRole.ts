import type { AxiosInstance } from "axios";

export async function deleteRoomRole(
  apiClient: AxiosInstance,
  slug: string,
  roleId: number,
): Promise<void> {
  await apiClient.delete(
    `/chat/rooms/${encodeURIComponent(slug)}/roles/${roleId}/`,
  );
}
