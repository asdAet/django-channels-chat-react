import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  DirectChatsResponseDto,
  DirectStartResponseDto,
  RoomMessagesDto,
} from "../dto";
import type {
  GlobalSearchResult,
  ReadStateResult,
  RoomAttachmentsResult,
  SearchResult,
  UnreadCountItem,
  UploadResult,
} from "../domain/interfaces/IApiService";
import type { RoomDetails as RoomDetailsDto } from "../entities/room/types";

const apiMocks = vi.hoisted(() => ({
  getPublicRoom: vi.fn<() => Promise<RoomDetailsDto>>(),
  getRoomDetails: vi.fn<(slug: string) => Promise<RoomDetailsDto>>(),
  getRoomMessages:
    vi.fn<
      (
        slug: string,
        params?: { limit?: number; beforeId?: number },
      ) => Promise<RoomMessagesDto>
    >(),
  startDirectChat:
    vi.fn<(username: string) => Promise<DirectStartResponseDto>>(),
  getDirectChats: vi.fn<() => Promise<DirectChatsResponseDto>>(),
  getUnreadCounts: vi.fn<() => Promise<UnreadCountItem[]>>(),
  editMessage:
    vi.fn<
      (
        slug: string,
        messageId: number,
        content: string,
      ) => Promise<{ id: number; content: string; editedAt: string }>
    >(),
  deleteMessage: vi.fn<(slug: string, messageId: number) => Promise<void>>(),
  addReaction: vi.fn<
    (
      slug: string,
      messageId: number,
      emoji: string,
    ) => Promise<{
      messageId: number;
      emoji: string;
      userId: number;
      username: string;
    }>
  >(),
  removeReaction:
    vi.fn<(slug: string, messageId: number, emoji: string) => Promise<void>>(),
  searchMessages:
    vi.fn<(slug: string, query: string) => Promise<SearchResult>>(),
  uploadAttachments: vi.fn<
    (
      slug: string,
      files: File[],
      options?: {
        onProgress?: (percent: number) => void;
        messageContent?: string;
        replyTo?: number | null;
        signal?: AbortSignal;
      },
    ) => Promise<UploadResult>
  >(),
  markRead:
    vi.fn<(slug: string, messageId?: number) => Promise<ReadStateResult>>(),
  globalSearch: vi.fn<
    (
      query: string,
      params?: {
        usersLimit?: number;
        groupsLimit?: number;
        messagesLimit?: number;
      },
    ) => Promise<GlobalSearchResult>
  >(),
  getRoomAttachments:
    vi.fn<
      (
        slug: string,
        params?: { limit?: number; before?: number },
      ) => Promise<RoomAttachmentsResult>
    >(),
}));

vi.mock("../adapters/ApiService", () => ({
  apiService: apiMocks,
}));

const loadController = async () => {
  vi.resetModules();
  const mod = await import("./ChatController");
  return mod.chatController;
};

const resetApiMocks = () => {
  Object.values(apiMocks).forEach((mock) => {
    mock.mockReset();
  });
};

describe("ChatController", () => {
  beforeEach(() => {
    resetApiMocks();
  });

  it("deduplicates in-flight public room request", async () => {
    let settle: (value: RoomDetailsDto) => void = () => undefined;
    const pending = new Promise<RoomDetailsDto>((res) => {
      settle = res;
    });
    apiMocks.getPublicRoom.mockReturnValue(pending);

    const chatController = await loadController();

    const firstPromise = chatController.getPublicRoom();
    const secondPromise = chatController.getPublicRoom();

    expect(apiMocks.getPublicRoom).toHaveBeenCalledTimes(1);

    settle({
      slug: "public",
      name: "Public",
      kind: "public",
      created: false,
      createdBy: null,
    });
    const [first, second] = await Promise.all([firstPromise, secondPromise]);

    expect(first.slug).toBe("public");
    expect(second.slug).toBe("public");
  });

  it("does not cache public room after request completes", async () => {
    const room: RoomDetailsDto = {
      slug: "public",
      name: "Public",
      kind: "public",
      created: false,
      createdBy: null,
    };
    apiMocks.getPublicRoom.mockResolvedValue(room);

    const chatController = await loadController();

    await chatController.getPublicRoom();
    await chatController.getPublicRoom();

    expect(apiMocks.getPublicRoom).toHaveBeenCalledTimes(2);
  });

  it("deduplicates in-flight room details by slug", async () => {
    let settle: (value: RoomDetailsDto) => void = () => undefined;
    const pending = new Promise<RoomDetailsDto>((res) => {
      settle = res;
    });
    apiMocks.getRoomDetails.mockReturnValue(pending);

    const chatController = await loadController();

    const firstPromise = chatController.getRoomDetails("abc");
    const secondPromise = chatController.getRoomDetails("abc");

    expect(apiMocks.getRoomDetails).toHaveBeenCalledTimes(1);

    settle({
      slug: "abc",
      name: "Room",
      kind: "private",
      created: false,
      createdBy: null,
    });
    const [first, second] = await Promise.all([firstPromise, secondPromise]);

    expect(first.slug).toBe("abc");
    expect(second.slug).toBe("abc");
  });

  it("does not cache room details after request completes", async () => {
    apiMocks.getRoomDetails.mockResolvedValue({
      slug: "abc",
      name: "Room",
      kind: "private",
      created: false,
      createdBy: null,
    });

    const chatController = await loadController();

    await chatController.getRoomDetails("abc");
    await chatController.getRoomDetails("abc");

    expect(apiMocks.getRoomDetails).toHaveBeenCalledTimes(2);
    expect(apiMocks.getRoomDetails).toHaveBeenNthCalledWith(1, "abc");
    expect(apiMocks.getRoomDetails).toHaveBeenNthCalledWith(2, "abc");
  });

  it("deduplicates in-flight room messages by params", async () => {
    let settle: (value: RoomMessagesDto) => void = () => undefined;
    const pending = new Promise<RoomMessagesDto>((res) => {
      settle = res;
    });
    apiMocks.getRoomMessages.mockReturnValue(pending);

    const chatController = await loadController();

    const firstPromise = chatController.getRoomMessages("public", {
      limit: 50,
    });
    const secondPromise = chatController.getRoomMessages("public", {
      limit: 50,
    });

    expect(apiMocks.getRoomMessages).toHaveBeenCalledTimes(1);

    settle({
      messages: [],
      pagination: { limit: 50, hasMore: false, nextBefore: null },
    });

    await Promise.all([firstPromise, secondPromise]);
  });

  it("does not cache room messages after request completes", async () => {
    apiMocks.getRoomMessages.mockResolvedValue({
      messages: [],
      pagination: { limit: 50, hasMore: false, nextBefore: null },
    });

    const chatController = await loadController();

    await chatController.getRoomMessages("public", { limit: 50 });
    await chatController.getRoomMessages("public", { limit: 50 });

    expect(apiMocks.getRoomMessages).toHaveBeenCalledTimes(2);
  });

  it("deduplicates in-flight direct chats request", async () => {
    let settle: (value: DirectChatsResponseDto) => void = () => undefined;
    const pending = new Promise<DirectChatsResponseDto>((res) => {
      settle = res;
    });
    apiMocks.getDirectChats.mockReturnValue(pending);

    const chatController = await loadController();

    const firstPromise = chatController.getDirectChats();
    const secondPromise = chatController.getDirectChats();

    expect(apiMocks.getDirectChats).toHaveBeenCalledTimes(1);

    settle({
      items: [
        {
          slug: "dm_123",
          peer: { username: "alice", profileImage: null },
          lastMessage: "hello",
          lastMessageAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });

    await Promise.all([firstPromise, secondPromise]);
  });

  it("does not cache direct chats after request completes", async () => {
    apiMocks.getDirectChats.mockResolvedValue({
      items: [
        {
          slug: "dm_123",
          peer: { username: "alice", profileImage: null },
          lastMessage: "hello",
          lastMessageAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });

    const chatController = await loadController();

    await chatController.getDirectChats();
    await chatController.getDirectChats();

    expect(apiMocks.getDirectChats).toHaveBeenCalledTimes(2);
  });

  it("delegates pass-through methods to apiService with original args", async () => {
    const directStartResponse: DirectStartResponseDto = {
      slug: "dm_1",
      kind: "direct",
      peer: {
        username: "alice",
        profileImage: null,
        avatarCrop: null,
        lastSeen: null,
        bio: null,
      },
    };
    const unreadCounts: UnreadCountItem[] = [
      { roomSlug: "room_1", unreadCount: 3 },
    ];
    const editedMessage = {
      id: 7,
      content: "edited",
      editedAt: "2026-01-01T00:00:00.000Z",
    };
    const reaction = {
      messageId: 7,
      emoji: "🔥",
      userId: 2,
      username: "alice",
    };
    const search: SearchResult = {
      results: [
        {
          id: 1,
          username: "alice",
          content: "hello",
          createdAt: "2026-01-01T00:00:00.000Z",
          highlight: "hello",
        },
      ],
      pagination: { limit: 20, hasMore: false, nextBefore: null },
    };
    const upload: UploadResult = {
      id: 10,
      content: "files",
      attachments: [
        {
          id: 1,
          originalFilename: "a.txt",
          contentType: "text/plain",
          fileSize: 4,
          url: null,
          thumbnailUrl: null,
          width: null,
          height: null,
        },
      ],
    };
    const readState: ReadStateResult = {
      roomSlug: "room_1",
      lastReadMessageId: 44,
    };
    const searchResult: GlobalSearchResult = {
      users: [
        {
          username: "alice",
          profileImage: null,
          avatarCrop: null,
          lastSeen: null,
        },
      ],
      groups: [
        {
          slug: "g1",
          name: "Group 1",
          description: "",
          username: "group1",
          memberCount: 2,
          isPublic: true,
        },
      ],
      messages: [
        {
          id: 9,
          username: "alice",
          content: "hello",
          createdAt: "2026-01-01T00:00:00.000Z",
          roomSlug: "room_1",
          roomName: "Room 1",
          roomKind: "group",
        },
      ],
    };
    const attachments: RoomAttachmentsResult = {
      items: [
        {
          id: 2,
          originalFilename: "b.txt",
          contentType: "text/plain",
          fileSize: 2,
          url: null,
          thumbnailUrl: null,
          width: null,
          height: null,
          messageId: 22,
          createdAt: "2026-01-01T00:00:00.000Z",
          username: "alice",
        },
      ],
      pagination: { limit: 20, hasMore: false, nextBefore: null },
    };

    apiMocks.startDirectChat.mockResolvedValue(directStartResponse);
    apiMocks.getUnreadCounts.mockResolvedValue(unreadCounts);
    apiMocks.editMessage.mockResolvedValue(editedMessage);
    apiMocks.deleteMessage.mockResolvedValue(undefined);
    apiMocks.addReaction.mockResolvedValue(reaction);
    apiMocks.removeReaction.mockResolvedValue(undefined);
    apiMocks.searchMessages.mockResolvedValue(search);
    apiMocks.uploadAttachments.mockResolvedValue(upload);
    apiMocks.markRead.mockResolvedValue(readState);
    apiMocks.globalSearch.mockResolvedValue(searchResult);
    apiMocks.getRoomAttachments.mockResolvedValue(attachments);

    const chatController = await loadController();
    const file = new File(["hello"], "hello.txt", { type: "text/plain" });

    await expect(chatController.startDirectChat("alice")).resolves.toEqual(
      directStartResponse,
    );
    await expect(chatController.getUnreadCounts()).resolves.toEqual(
      unreadCounts,
    );
    await expect(
      chatController.editMessage("room_1", 7, "edited"),
    ).resolves.toEqual(editedMessage);
    await expect(
      chatController.deleteMessage("room_1", 7),
    ).resolves.toBeUndefined();
    await expect(
      chatController.addReaction("room_1", 7, "🔥"),
    ).resolves.toEqual(reaction);
    await expect(
      chatController.removeReaction("room_1", 7, "🔥"),
    ).resolves.toBeUndefined();
    await expect(
      chatController.searchMessages("room_1", "hello"),
    ).resolves.toEqual(search);
    await expect(
      chatController.uploadAttachments("room_1", [file], {
        messageContent: "files",
      }),
    ).resolves.toEqual(upload);
    await expect(chatController.markRead("room_1", 44)).resolves.toEqual(
      readState,
    );
    await expect(
      chatController.globalSearch("alice", {
        usersLimit: 5,
        groupsLimit: 3,
        messagesLimit: 2,
      }),
    ).resolves.toEqual(searchResult);
    await expect(
      chatController.getRoomAttachments("room_1", { limit: 20, before: 100 }),
    ).resolves.toEqual(attachments);

    expect(apiMocks.startDirectChat).toHaveBeenCalledWith("alice");
    expect(apiMocks.getUnreadCounts).toHaveBeenCalledTimes(1);
    expect(apiMocks.editMessage).toHaveBeenCalledWith("room_1", 7, "edited");
    expect(apiMocks.deleteMessage).toHaveBeenCalledWith("room_1", 7);
    expect(apiMocks.addReaction).toHaveBeenCalledWith("room_1", 7, "🔥");
    expect(apiMocks.removeReaction).toHaveBeenCalledWith("room_1", 7, "🔥");
    expect(apiMocks.searchMessages).toHaveBeenCalledWith("room_1", "hello");
    expect(apiMocks.uploadAttachments).toHaveBeenCalledWith("room_1", [file], {
      messageContent: "files",
    });
    expect(apiMocks.markRead).toHaveBeenCalledWith("room_1", 44);
    expect(apiMocks.globalSearch).toHaveBeenCalledWith("alice", {
      usersLimit: 5,
      groupsLimit: 3,
      messagesLimit: 2,
    });
    expect(apiMocks.getRoomAttachments).toHaveBeenCalledWith("room_1", {
      limit: 20,
      before: 100,
    });
  });
});
