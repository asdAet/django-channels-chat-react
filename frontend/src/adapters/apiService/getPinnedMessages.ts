import type { AxiosInstance } from "axios";

import { decodePinnedMessagesResponse } from "../../dto";
import type { PinnedMessage } from "../../entities/group/types";

export async function getPinnedMessages(
  apiClient: AxiosInstance,
  slug: string,
): Promise<PinnedMessage[]> {
  const response = await apiClient.get<unknown>(
    `/groups/${encodeURIComponent(slug)}/pins/`,
  );
  return decodePinnedMessagesResponse(response.data);
}
