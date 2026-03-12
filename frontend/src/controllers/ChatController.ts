import { apiService } from "../adapters/ApiService";
import type {
  DirectChatsResponseDto,
  DirectStartResponseDto,
  RoomMessagesDto,
  RoomMessagesParams,
} from "../dto";
import type {
  EditMessageResult,
  GlobalSearchResult,
  ReactionResult,
  RoomAttachmentsResult,
  SearchResult,
  UploadResult,
  UploadAttachmentsOptions,
  ReadStateResult,
  UnreadCountItem,
} from "../domain/interfaces/IApiService";
import type { RoomDetails as RoomDetailsDto } from "../entities/room/types";

let publicRoomInFlight: Promise<RoomDetailsDto> | null = null;
let directChatsInFlight: Promise<DirectChatsResponseDto> | null = null;

const roomDetailsInFlight = new Map<string, Promise<RoomDetailsDto>>();
const roomMessagesInFlight = new Map<string, Promise<RoomMessagesDto>>();

/**
 * Выполняет функцию `buildRoomMessagesKey`.
 * @param slug Входной параметр `slug`.
 * @returns Результат выполнения `buildRoomMessagesKey`.
 */

const buildRoomMessagesKey = (slug: string, params?: RoomMessagesParams) => {
  const limit = params?.limit ?? "";
  const beforeId = params?.beforeId ?? "";
  return `${slug}|limit=${limit}|before=${beforeId}`;
};

/**
 * Описывает назначение класса `ChatController`.
 */

class ChatController {
  /**
   * Выполняет метод `getPublicRoom`.
   * @returns Результат выполнения `getPublicRoom`.
   */

  public async getPublicRoom(): Promise<RoomDetailsDto> {
    if (publicRoomInFlight) {
      return publicRoomInFlight;
    }

    publicRoomInFlight = apiService.getPublicRoom().finally(() => {
      publicRoomInFlight = null;
    });

    return publicRoomInFlight;
  }

  /**
   * Выполняет метод `getRoomDetails`.
   * @param slug Входной параметр `slug`.
   * @returns Результат выполнения `getRoomDetails`.
   */

  public async getRoomDetails(slug: string): Promise<RoomDetailsDto> {
    const inFlight = roomDetailsInFlight.get(slug);
    if (inFlight) {
      return inFlight;
    }

    const request = apiService.getRoomDetails(slug).finally(() => {
      roomDetailsInFlight.delete(slug);
    });

    roomDetailsInFlight.set(slug, request);
    return request;
  }

  /**
   * Выполняет метод `getRoomMessages`.
   * @param slug Входной параметр `slug`.
   * @returns Результат выполнения `getRoomMessages`.
   */

  public async getRoomMessages(
    slug: string,
    params?: RoomMessagesParams,
  ): Promise<RoomMessagesDto> {
    const cacheKey = buildRoomMessagesKey(slug, params);
    const inFlight = roomMessagesInFlight.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }

    const request = apiService.getRoomMessages(slug, params).finally(() => {
      roomMessagesInFlight.delete(cacheKey);
    });

    roomMessagesInFlight.set(cacheKey, request);
    return request;
  }

  /**
   * Выполняет метод `startDirectChat`.
   * @param username Входной параметр `username`.
   * @returns Результат выполнения `startDirectChat`.
   */

  public async startDirectChat(
    username: string,
  ): Promise<DirectStartResponseDto> {
    const response = await apiService.startDirectChat(username);
    return response;
  }

  /**
   * Выполняет метод `getDirectChats`.
   * @returns Результат выполнения `getDirectChats`.
   */

  public async getDirectChats(): Promise<DirectChatsResponseDto> {
    if (directChatsInFlight) {
      return directChatsInFlight;
    }

    directChatsInFlight = apiService.getDirectChats().finally(() => {
      directChatsInFlight = null;
    });

    return directChatsInFlight;
  }
  public async getUnreadCounts(): Promise<UnreadCountItem[]> {
    return apiService.getUnreadCounts();
  }

  public async editMessage(
    slug: string,
    messageId: number,
    content: string,
  ): Promise<EditMessageResult> {
    return apiService.editMessage(slug, messageId, content);
  }

  public async deleteMessage(slug: string, messageId: number): Promise<void> {
    return apiService.deleteMessage(slug, messageId);
  }

  public async addReaction(
    slug: string,
    messageId: number,
    emoji: string,
  ): Promise<ReactionResult> {
    return apiService.addReaction(slug, messageId, emoji);
  }

  public async removeReaction(
    slug: string,
    messageId: number,
    emoji: string,
  ): Promise<void> {
    return apiService.removeReaction(slug, messageId, emoji);
  }

  public async searchMessages(
    slug: string,
    query: string,
  ): Promise<SearchResult> {
    return apiService.searchMessages(slug, query);
  }

  public async uploadAttachments(
    slug: string,
    files: File[],
    options?: UploadAttachmentsOptions,
  ): Promise<UploadResult> {
    return apiService.uploadAttachments(slug, files, options);
  }

  public async markRead(
    slug: string,
    messageId?: number,
  ): Promise<ReadStateResult> {
    return apiService.markRead(slug, messageId);
  }

  public async globalSearch(
    query: string,
    params?: {
      usersLimit?: number;
      groupsLimit?: number;
      messagesLimit?: number;
    },
  ): Promise<GlobalSearchResult> {
    return apiService.globalSearch(query, params);
  }

  public async getRoomAttachments(
    slug: string,
    params?: { limit?: number; before?: number },
  ): Promise<RoomAttachmentsResult> {
    return apiService.getRoomAttachments(slug, params);
  }
}

export const chatController = new ChatController();
