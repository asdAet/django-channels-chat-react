import type { AxiosInstance } from "axios";

import { decodeReactionResponse } from "../../dto";
import type { ReactionResult } from "../../domain/interfaces/IApiService";

export async function addReaction(
  apiClient: AxiosInstance,
  slug: string,
  messageId: number,
  emoji: string,
): Promise<ReactionResult> {
  const encodedSlug = encodeURIComponent(slug);
  const response = await apiClient.post<unknown>(
    `/chat/rooms/${encodedSlug}/messages/${messageId}/reactions/`,
    { emoji },
  );
  return decodeReactionResponse(response.data);
}
