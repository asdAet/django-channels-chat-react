import type { AxiosInstance } from "axios";

import { decodeInvitePreviewResponse } from "../../dto";
import type { InvitePreview } from "../../entities/group/types";

export async function getInvitePreview(
  apiClient: AxiosInstance,
  code: string,
): Promise<InvitePreview> {
  const response = await apiClient.get<unknown>(
    `/invite/${encodeURIComponent(code)}/`,
  );
  return decodeInvitePreviewResponse(response.data);
}
