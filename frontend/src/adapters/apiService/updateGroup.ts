import type { AxiosInstance } from "axios";

import { decodeGroupResponse } from "../../dto";
import type { UpdateGroupInput } from "../../domain/interfaces/IApiService";
import type { Group } from "../../entities/group/types";

const appendScalar = (formData: FormData, key: string, value: unknown) => {
  if (value === undefined) return;
  if (value === null) {
    formData.append(key, "");
    return;
  }
  if (typeof value === "boolean") {
    formData.append(key, value ? "true" : "false");
    return;
  }
  formData.append(key, String(value));
};

export async function updateGroup(
  apiClient: AxiosInstance,
  slug: string,
  data: UpdateGroupInput,
): Promise<Group> {
  const { avatar, avatarAction, avatarCrop, ...rest } = data;
  const hasMultipartPayload = avatar instanceof File;
  const payload: Record<string, unknown> = { ...rest };
  if (avatarAction) {
    payload.avatarAction = avatarAction;
  }
  if (avatarCrop) {
    payload.avatarCropX = avatarCrop.x;
    payload.avatarCropY = avatarCrop.y;
    payload.avatarCropWidth = avatarCrop.width;
    payload.avatarCropHeight = avatarCrop.height;
  }

  const endpoint = `/groups/${encodeURIComponent(slug)}/`;

  if (!hasMultipartPayload) {
    const response = await apiClient.patch<unknown>(endpoint, payload);
    return decodeGroupResponse(response.data);
  }

  const formData = new FormData();
  appendScalar(formData, "name", rest.name);
  appendScalar(formData, "description", rest.description);
  appendScalar(formData, "isPublic", rest.isPublic);
  appendScalar(formData, "username", rest.username);
  appendScalar(formData, "slowModeSeconds", rest.slowModeSeconds);
  appendScalar(formData, "joinApprovalRequired", rest.joinApprovalRequired);
  appendScalar(formData, "avatarCropX", payload.avatarCropX);
  appendScalar(formData, "avatarCropY", payload.avatarCropY);
  appendScalar(formData, "avatarCropWidth", payload.avatarCropWidth);
  appendScalar(formData, "avatarCropHeight", payload.avatarCropHeight);

  if (avatar instanceof File) {
    formData.append("avatar", avatar);
  }
  if (avatarAction) {
    formData.append("avatarAction", avatarAction);
  }

  const response = await apiClient.patch<unknown>(endpoint, formData);
  return decodeGroupResponse(response.data);
}
