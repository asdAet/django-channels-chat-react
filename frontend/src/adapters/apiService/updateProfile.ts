import type { AxiosInstance } from "axios";

import {
  buildUpdateProfileRequestDto,
  decodeProfileEnvelopeResponse,
} from "../../dto";
import type { UpdateProfileInput } from "../../domain/interfaces/IApiService";
import type { UserProfile } from "../../entities/user/types";

/**
 * Обновляет профиль пользователя.
 * @param apiClient HTTP-клиент.
 * @param fields Поля формы профиля.
 * @returns Нормализованный профиль пользователя.
 */
export async function updateProfile(
  apiClient: AxiosInstance,
  fields: UpdateProfileInput,
): Promise<{ user: UserProfile }> {
  const dto = buildUpdateProfileRequestDto(fields);

  const form = new FormData();
  if (dto.name !== undefined) {
    form.append("name", dto.name);
  }
  if (dto.last_name !== undefined) {
    form.append("last_name", dto.last_name);
  }
  form.append("username", dto.username);
  form.append("email", dto.email);
  if (dto.image) {
    form.append("image", dto.image);
  }
  if (dto.avatarCrop) {
    form.append("avatarCropX", String(dto.avatarCrop.x));
    form.append("avatarCropY", String(dto.avatarCrop.y));
    form.append("avatarCropWidth", String(dto.avatarCrop.width));
    form.append("avatarCropHeight", String(dto.avatarCrop.height));
  }
  if (dto.bio !== undefined) {
    form.append("bio", dto.bio);
  }

  const response = await apiClient.post<unknown>("/auth/profile/", form);
  return decodeProfileEnvelopeResponse(response.data);
}
