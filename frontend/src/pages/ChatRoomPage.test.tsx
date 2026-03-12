import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Message } from "../entities/message/types";
import type { RoomDetails } from "../entities/room/types";

const wsState = vi.hoisted(() => ({
  status: "online" as "online" | "connecting" | "offline" | "error" | "closed",
  lastError: null as string | null,
  send: vi.fn<(payload: string) => boolean>(),
  options: null as {
    onMessage?: (event: MessageEvent) => void;
  } | null,
}));

const chatRoomMock = vi.hoisted(() => ({
  details: {
    slug: "public",
    name: "Public",
    kind: "public",
    created: false,
    createdBy: null,
  } as RoomDetails,
  messages: [] as Message[],
  loading: false,
  loadingMore: false,
  hasMore: false,
  error: null as string | null,
  loadMore: vi.fn(),
  reload: vi.fn(),
  setMessages: vi.fn(),
}));

const presenceMock = vi.hoisted(() => ({
  online: [] as Array<{ username: string; profileImage: string | null }>,
  guests: 0,
  status: "online" as const,
  lastError: null as string | null,
}));

const infoPanelMock = vi.hoisted(() => ({
  open: vi.fn(),
}));

const permissionsMock = vi.hoisted(() => ({
  loading: false,
  raw: null,
  isMember: true,
  isBanned: false,
  canJoin: false,
  canRead: true,
  canWrite: true,
  canAttachFiles: true,
  canReact: true,
  canManageMessages: false,
  canManageRoles: false,
  canManageRoom: false,
  canKick: false,
  canBan: false,
  canInvite: false,
  canMute: false,
  isAdmin: false,
  refresh: vi.fn().mockResolvedValue(undefined),
}));

const groupControllerMock = vi.hoisted(() => ({
  joinGroup: vi.fn().mockResolvedValue(undefined),
}));

const chatControllerMock = vi.hoisted(() => ({
  editMessage: vi.fn().mockResolvedValue({}),
  deleteMessage: vi.fn().mockResolvedValue(undefined),
  addReaction: vi.fn().mockResolvedValue({}),
  removeReaction: vi.fn().mockResolvedValue(undefined),
  searchMessages: vi.fn().mockResolvedValue({ results: [] }),
  uploadAttachments: vi.fn().mockResolvedValue({}),
  markRead: vi.fn().mockResolvedValue({}),
}));

vi.mock("react-router-dom", () => ({
  useLocation: () => ({ search: "" }),
}));

vi.mock("../hooks/useChatRoom", () => ({
  useChatRoom: () => chatRoomMock,
}));

vi.mock("../hooks/useOnlineStatus", () => ({
  useOnlineStatus: () => true,
}));

vi.mock("../hooks/useReconnectingWebSocket", () => ({
  useReconnectingWebSocket: (options: unknown) => {
    wsState.options = options as { onMessage?: (event: MessageEvent) => void };
    return {
      status: wsState.status,
      lastError: wsState.lastError,
      send: wsState.send,
      reconnect: vi.fn(),
    };
  },
}));

vi.mock("../shared/presence", () => ({
  usePresence: () => presenceMock,
}));

vi.mock("../hooks/useTypingIndicator", () => ({
  useTypingIndicator: () => ({ sendTyping: vi.fn() }),
}));

vi.mock("../hooks/useRoomPermissions", () => ({
  useRoomPermissions: () => permissionsMock,
}));

vi.mock("../shared/directInbox", () => ({
  useDirectInbox: () => ({ setActiveRoom: vi.fn(), markRead: vi.fn() }),
}));

vi.mock("../shared/config/limits", () => ({
  useChatMessageMaxLength: () => 2000,
  useChatAttachmentMaxSizeMb: () => 10,
  useChatAttachmentMaxPerMessage: () => 5,
  useChatAttachmentAllowedTypes: () => [
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
    "text/plain",
    "video/mp4",
    "audio/mpeg",
    "audio/webm",
  ],
}));

vi.mock("../shared/layout/useInfoPanel", () => ({
  useInfoPanel: () => infoPanelMock,
}));

vi.mock("../controllers/ChatController", () => ({
  chatController: chatControllerMock,
}));

vi.mock("../controllers/GroupController", () => ({
  groupController: groupControllerMock,
}));

import { ChatRoomPage } from "./ChatRoomPage";

const user = {
  username: "demo",
  email: "demo@example.com",
  profileImage: null,
  bio: "",
  lastSeen: null,
  registeredAt: null,
};

const makeForeignMessage = (id: number, content: string): Message => ({
  id,
  username: "alice",
  content,
  profilePic: null,
  createdAt: `2026-02-13T12:0${Math.max(0, id - 1)}:00.000Z`,
  editedAt: null,
  isDeleted: false,
  replyTo: null,
  attachments: [],
  reactions: [],
});

describe("ChatRoomPage", () => {
  beforeEach(() => {
    wsState.status = "online";
    wsState.lastError = null;
    wsState.send.mockReset().mockReturnValue(true);
    wsState.options = null;

    chatRoomMock.details = {
      slug: "public",
      name: "Public",
      kind: "public",
      created: false,
      createdBy: null,
    } as RoomDetails;
    chatRoomMock.messages = [];
    chatRoomMock.loading = false;
    chatRoomMock.loadingMore = false;
    chatRoomMock.hasMore = false;
    chatRoomMock.error = null;
    chatRoomMock.loadMore.mockReset();
    chatRoomMock.reload.mockReset();
    chatRoomMock.setMessages.mockReset();
    chatRoomMock.setMessages.mockImplementation(
      (updater: ((prev: Message[]) => Message[]) | Message[]) => {
        chatRoomMock.messages =
          typeof updater === "function"
            ? updater(chatRoomMock.messages)
            : updater;
      },
    );
    permissionsMock.loading = false;
    permissionsMock.raw = null;
    permissionsMock.isMember = true;
    permissionsMock.isBanned = false;
    permissionsMock.canJoin = false;
    permissionsMock.canRead = true;
    permissionsMock.canWrite = true;
    permissionsMock.canAttachFiles = true;
    permissionsMock.canReact = true;
    permissionsMock.canManageMessages = false;
    permissionsMock.canManageRoles = false;
    permissionsMock.canManageRoom = false;
    permissionsMock.canKick = false;
    permissionsMock.canBan = false;
    permissionsMock.canInvite = false;
    permissionsMock.canMute = false;
    permissionsMock.isAdmin = false;
    permissionsMock.refresh.mockReset().mockResolvedValue(undefined);
    groupControllerMock.joinGroup.mockReset().mockResolvedValue(undefined);
    chatControllerMock.markRead.mockReset().mockResolvedValue({});
    presenceMock.online = [];
    presenceMock.status = "online";
    presenceMock.lastError = null;
    infoPanelMock.open.mockReset();
    Object.defineProperty(window.navigator, "sendBeacon", {
      configurable: true,
      value: undefined,
    });
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
  });

  it("shows read-only mode for guest in public room", () => {
    render(<ChatRoomPage slug="public" user={null} onNavigate={vi.fn()} />);

    expect(screen.getByTestId("chat-auth-callout")).toBeInTheDocument();
    expect(screen.queryByLabelText("Сообщение")).toBeNull();
  });

  it("sends message for authenticated user", () => {
    render(<ChatRoomPage slug="public" user={user} onNavigate={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Сообщение"), {
      target: { value: "Hello from test" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Отправить сообщение" }),
    );

    expect(wsState.send).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(wsState.send.mock.calls[0][0]);
    expect(payload.message).toBe("Hello from test");
    expect(payload.username).toBe("demo");
  });

  it("disables submit while websocket is not online", () => {
    wsState.status = "connecting";

    render(<ChatRoomPage slug="public" user={user} onNavigate={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Сообщение"), {
      target: { value: "text" },
    });

    expect(
      screen.getByRole("button", { name: "Отправить сообщение" }),
    ).toBeDisabled();
  });

  it("activates local rate limit cooldown from ws error event", () => {
    render(<ChatRoomPage slug="public" user={user} onNavigate={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Сообщение"), {
      target: { value: "text" },
    });
    expect(
      screen.getByRole("button", { name: "Отправить сообщение" }),
    ).toBeEnabled();

    act(() => {
      wsState.options?.onMessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({ error: "rate_limited", retry_after: 2 }),
        }),
      );
    });

    expect(
      screen.getByRole("button", { name: "Отправить сообщение" }),
    ).toBeDisabled();
  });

  it("shows online status for direct peer", () => {
    chatRoomMock.details = {
      slug: "dm_1",
      name: "dm",
      kind: "direct",
      created: false,
      createdBy: null,
      peer: {
        username: "alice",
        profileImage: null,
        lastSeen: "2026-02-13T10:00:00.000Z",
      },
    } as RoomDetails;
    presenceMock.online = [{ username: "alice", profileImage: null }];

    render(<ChatRoomPage slug="dm_1" user={user} onNavigate={vi.fn()} />);
    expect(screen.getByText("В сети")).toBeInTheDocument();
  });

  it("highlights own messages", () => {
    chatRoomMock.messages = [
      {
        id: 3,
        username: "demo",
        content: "mine",
        profilePic: null,
        createdAt: "2026-02-13T12:00:00.000Z",
        editedAt: null,
        isDeleted: false,
        replyTo: null,
        attachments: [],
        reactions: [],
      },
      {
        id: 4,
        username: "alice",
        content: "other",
        profilePic: null,
        createdAt: "2026-02-13T12:01:00.000Z",
        editedAt: null,
        isDeleted: false,
        replyTo: null,
        attachments: [],
        reactions: [],
      },
    ];

    const { container } = render(
      <ChatRoomPage slug="public" user={user} onNavigate={vi.fn()} />,
    );

    expect(
      container.querySelector('article[data-own-message="true"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('article[data-own-message="false"]'),
    ).not.toBeNull();
  });

  it("shows join CTA and hides input for public group non-member", async () => {
    chatRoomMock.details = {
      slug: "g-public-1",
      name: "Public Group",
      kind: "group",
      created: false,
      createdBy: null,
    } as RoomDetails;
    permissionsMock.loading = false;
    permissionsMock.isMember = false;
    permissionsMock.canWrite = false;
    permissionsMock.canJoin = true;

    render(<ChatRoomPage slug="g-public-1" user={user} onNavigate={vi.fn()} />);

    expect(screen.getByTestId("group-join-callout")).toBeInTheDocument();
    expect(screen.queryByLabelText("Сообщение")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Присоединиться" }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(groupControllerMock.joinGroup).toHaveBeenCalledWith("g-public-1");
    expect(permissionsMock.refresh).toHaveBeenCalledTimes(1);
    expect(chatRoomMock.reload).toHaveBeenCalledTimes(1);
  });

  it("deduplicates mark-read for same last message id", async () => {
    chatRoomMock.details = {
      slug: "dm_1",
      name: "dm",
      kind: "direct",
      created: false,
      createdBy: null,
      peer: { username: "alice", profileImage: null, lastSeen: null },
    } as RoomDetails;
    chatRoomMock.messages = [
      {
        id: 1,
        username: "alice",
        content: "first",
        profilePic: null,
        createdAt: "2026-02-13T12:00:00.000Z",
        editedAt: null,
        isDeleted: false,
        replyTo: null,
        attachments: [],
        reactions: [],
      },
      {
        id: 2,
        username: "alice",
        content: "second",
        profilePic: null,
        createdAt: "2026-02-13T12:01:00.000Z",
        editedAt: null,
        isDeleted: false,
        replyTo: null,
        attachments: [],
        reactions: [],
      },
    ];

    const { container, rerender } = render(
      <ChatRoomPage slug="dm_1" user={user} onNavigate={vi.fn()} />,
    );
    const chatLog = container.querySelector(
      '[aria-live="polite"]',
    ) as HTMLDivElement;

    const mockViewport = () => {
      Object.defineProperty(chatLog, "getBoundingClientRect", {
        configurable: true,
        value: () => ({ bottom: 600 }),
      });
      chatLog
        .querySelectorAll<HTMLElement>("article[data-message-id]")
        .forEach((node, index) => {
          Object.defineProperty(node, "getBoundingClientRect", {
            configurable: true,
            value: () => ({ bottom: 120 + index * 120 }),
          });
        });
    };
    mockViewport();

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 220));
    });
    fireEvent.scroll(chatLog);

    await waitFor(() => {
      expect(chatControllerMock.markRead).toHaveBeenCalledWith("dm_1", 2);
    });
    expect(chatControllerMock.markRead).toHaveBeenCalledTimes(1);

    chatRoomMock.messages = [...chatRoomMock.messages];
    rerender(<ChatRoomPage slug="dm_1" user={user} onNavigate={vi.fn()} />);
    mockViewport();
    fireEvent.scroll(chatLog);

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 220));
    });
    expect(chatControllerMock.markRead).toHaveBeenCalledTimes(1);

    chatRoomMock.messages = [
      ...chatRoomMock.messages,
      {
        id: 3,
        username: "alice",
        content: "third",
        profilePic: null,
        createdAt: "2026-02-13T12:02:00.000Z",
        editedAt: null,
        isDeleted: false,
        replyTo: null,
        attachments: [],
        reactions: [],
      },
    ];
    rerender(<ChatRoomPage slug="dm_1" user={user} onNavigate={vi.fn()} />);
    mockViewport();
    fireEvent.scroll(chatLog);

    await waitFor(() => {
      expect(chatControllerMock.markRead).toHaveBeenCalledWith("dm_1", 3);
    });
    expect(chatControllerMock.markRead).toHaveBeenCalledTimes(2);
  });

  it("rejects unsupported attachment type on client before upload request", () => {
    const { container } = render(
      <ChatRoomPage slug="public" user={user} onNavigate={vi.fn()} />,
    );

    const fileInput = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const invalidFile = new File(["payload"], "virus.exe", {
      type: "application/x-msdownload",
    });
    fireEvent.change(fileInput, { target: { files: [invalidFile] } });

    expect(screen.getByText(/имеет неподдерживаемый тип/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Отправить сообщение" }),
    ).toBeDisabled();
    expect(chatControllerMock.uploadAttachments).not.toHaveBeenCalled();
  });

  it("uploads only valid attachments from mixed selection and maps backend error by code", async () => {
    chatControllerMock.uploadAttachments.mockRejectedValueOnce({
      data: {
        code: "unsupported_type",
        details: { allowedTypes: ["text/plain"] },
      },
      message: "Request failed",
    });

    const { container } = render(
      <ChatRoomPage slug="public" user={user} onNavigate={vi.fn()} />,
    );

    const fileInput = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const invalidFile = new File(["payload"], "bad.exe", {
      type: "application/x-msdownload",
    });
    const validFile = new File(["hello"], "ok.txt", { type: "text/plain" });
    fireEvent.change(fileInput, {
      target: { files: [invalidFile, validFile] },
    });

    expect(screen.getByText(/имеет неподдерживаемый тип/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Отправить сообщение" }),
    ).toBeEnabled();

    fireEvent.click(
      screen.getByRole("button", { name: "Отправить сообщение" }),
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(chatControllerMock.uploadAttachments).toHaveBeenCalledTimes(1);
    const filesArg = chatControllerMock.uploadAttachments.mock
      .calls[0][1] as File[];
    expect(filesArg).toHaveLength(1);
    expect(filesArg[0].name).toBe("ok.txt");

    expect(
      screen.getByText("Тип файла не поддерживается. Разрешены: text/plain."),
    ).toBeInTheDocument();
  });

  it("keeps unread divider anchored while partially reading and after full read in current chat", async () => {
    chatRoomMock.details = {
      slug: "dm_1",
      name: "dm",
      kind: "direct",
      created: false,
      createdBy: null,
      peer: { username: "alice", profileImage: null, lastSeen: null },
      lastReadMessageId: 0,
    } as RoomDetails;
    chatRoomMock.messages = [
      makeForeignMessage(1, "first"),
      makeForeignMessage(2, "second"),
      makeForeignMessage(3, "third"),
    ];

    const { container } = render(
      <ChatRoomPage slug="dm_1" user={user} onNavigate={vi.fn()} />,
    );
    const chatLog = container.querySelector(
      '[aria-live="polite"]',
    ) as HTMLDivElement;

    const setScrollMetrics = (
      scrollTop: number,
      scrollHeight = 1200,
      clientHeight = 400,
    ) => {
      Object.defineProperty(chatLog, "scrollTop", {
        configurable: true,
        value: scrollTop,
        writable: true,
      });
      Object.defineProperty(chatLog, "scrollHeight", {
        configurable: true,
        value: scrollHeight,
      });
      Object.defineProperty(chatLog, "clientHeight", {
        configurable: true,
        value: clientHeight,
      });
    };

    const setViewport = (
      listBottom: number,
      bottoms: Record<number, number>,
    ) => {
      Object.defineProperty(chatLog, "getBoundingClientRect", {
        configurable: true,
        value: () => ({ bottom: listBottom }),
      });
      chatLog
        .querySelectorAll<HTMLElement>("article[data-message-id]")
        .forEach((node) => {
          const id = Number(node.dataset.messageId);
          Object.defineProperty(node, "getBoundingClientRect", {
            configurable: true,
            value: () => ({ bottom: bottoms[id] ?? Number.MAX_SAFE_INTEGER }),
          });
        });
    };

    setScrollMetrics(160);
    setViewport(220, { 1: 180, 2: 360, 3: 520 });

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 260));
    });
    fireEvent.scroll(chatLog);

    let divider = chatLog.querySelector<HTMLElement>("[data-unread-divider]");
    expect(divider).not.toBeNull();
    expect(divider?.dataset.unreadAnchorId).toBe("1");

    const firstMessage = chatLog.querySelector('article[data-message-id="1"]');
    const indexOfDivider = Array.from(chatLog.children).findIndex(
      (node) => node === divider,
    );
    const indexOfFirstMessage = Array.from(chatLog.children).findIndex(
      (node) => node === firstMessage,
    );
    expect(indexOfDivider).toBeGreaterThanOrEqual(0);
    expect(indexOfDivider).toBeLessThan(indexOfFirstMessage);

    setScrollMetrics(200);
    setViewport(220, { 1: 120, 2: 180, 3: 410 });
    fireEvent.scroll(chatLog);
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 220));
    });

    divider = chatLog.querySelector<HTMLElement>("[data-unread-divider]");
    expect(divider).not.toBeNull();
    expect(divider?.dataset.unreadAnchorId).toBe("1");

    setScrollMetrics(780, 1200, 400);
    setViewport(220, { 1: 110, 2: 150, 3: 190 });
    fireEvent.scroll(chatLog);
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 260));
    });

    divider = chatLog.querySelector<HTMLElement>("[data-unread-divider]");
    expect(divider).not.toBeNull();
    expect(divider?.dataset.unreadAnchorId).toBe("1");
  });

  it("hides unread divider when current user sends a message", async () => {
    chatRoomMock.details = {
      slug: "dm_1",
      name: "dm",
      kind: "direct",
      created: false,
      createdBy: null,
      peer: { username: "alice", profileImage: null, lastSeen: null },
      lastReadMessageId: 0,
    } as RoomDetails;
    chatRoomMock.messages = [
      makeForeignMessage(1, "first"),
      makeForeignMessage(2, "second"),
    ];

    const { container } = render(
      <ChatRoomPage slug="dm_1" user={user} onNavigate={vi.fn()} />,
    );
    const chatLog = container.querySelector(
      '[aria-live="polite"]',
    ) as HTMLDivElement;

    Object.defineProperty(chatLog, "scrollTop", {
      configurable: true,
      value: 160,
      writable: true,
    });
    Object.defineProperty(chatLog, "scrollHeight", {
      configurable: true,
      value: 1200,
    });
    Object.defineProperty(chatLog, "clientHeight", {
      configurable: true,
      value: 400,
    });
    Object.defineProperty(chatLog, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ bottom: 220 }),
    });
    chatLog
      .querySelectorAll<HTMLElement>("article[data-message-id]")
      .forEach((node, index) => {
        Object.defineProperty(node, "getBoundingClientRect", {
          configurable: true,
          value: () => ({ bottom: 180 + index * 180 }),
        });
      });

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 260));
    });
    fireEvent.scroll(chatLog);

    expect(chatLog.querySelector("[data-unread-divider]")).not.toBeNull();

    fireEvent.change(screen.getByLabelText("Сообщение"), {
      target: { value: "my message" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Отправить сообщение" }),
    );

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 60));
    });

    expect(chatLog.querySelector("[data-unread-divider]")).toBeNull();
  });

  it("does not show unread divider for incoming message when user is at bottom", async () => {
    chatRoomMock.details = {
      slug: "dm_1",
      name: "dm",
      kind: "direct",
      created: false,
      createdBy: null,
      peer: { username: "alice", profileImage: null, lastSeen: null },
      lastReadMessageId: 2,
    } as RoomDetails;
    chatRoomMock.messages = [
      makeForeignMessage(1, "first"),
      makeForeignMessage(2, "second"),
    ];

    const { container, rerender } = render(
      <ChatRoomPage slug="dm_1" user={user} onNavigate={vi.fn()} />,
    );
    const chatLog = container.querySelector(
      '[aria-live="polite"]',
    ) as HTMLDivElement;

    const setScrollMetrics = (
      scrollTop: number,
      scrollHeight = 1200,
      clientHeight = 400,
    ) => {
      Object.defineProperty(chatLog, "scrollTop", {
        configurable: true,
        value: scrollTop,
        writable: true,
      });
      Object.defineProperty(chatLog, "scrollHeight", {
        configurable: true,
        value: scrollHeight,
      });
      Object.defineProperty(chatLog, "clientHeight", {
        configurable: true,
        value: clientHeight,
      });
    };

    const setViewport = (
      listBottom: number,
      bottoms: Record<number, number>,
    ) => {
      Object.defineProperty(chatLog, "getBoundingClientRect", {
        configurable: true,
        value: () => ({ bottom: listBottom }),
      });
      chatLog
        .querySelectorAll<HTMLElement>("article[data-message-id]")
        .forEach((node) => {
          const id = Number(node.dataset.messageId);
          Object.defineProperty(node, "getBoundingClientRect", {
            configurable: true,
            value: () => ({ bottom: bottoms[id] ?? Number.MAX_SAFE_INTEGER }),
          });
        });
    };

    setScrollMetrics(800, 1200, 400);
    setViewport(260, { 1: 120, 2: 170 });
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 220));
    });
    fireEvent.scroll(chatLog);

    act(() => {
      wsState.options?.onMessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({
            id: 3,
            message: "third",
            username: "alice",
            profile_pic: null,
            room: "dm_1",
            createdAt: "2026-02-13T12:03:00.000Z",
            attachments: [],
          }),
        }),
      );
    });

    rerender(<ChatRoomPage slug="dm_1" user={user} onNavigate={vi.fn()} />);
    setViewport(260, { 1: 120, 2: 170, 3: 210 });
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 240));
    });
    fireEvent.scroll(chatLog);

    expect(chatLog.querySelector("[data-unread-divider]")).toBeNull();
  });

  it("performs a single initial scroll to bottom when unread messages are absent", async () => {
    chatRoomMock.details = {
      slug: "dm_1",
      name: "dm",
      kind: "direct",
      created: false,
      createdBy: null,
      peer: { username: "alice", profileImage: null, lastSeen: null },
      lastReadMessageId: 3,
    } as RoomDetails;
    chatRoomMock.messages = [
      makeForeignMessage(1, "first"),
      makeForeignMessage(2, "second"),
      makeForeignMessage(3, "third"),
    ];

    const { container } = render(
      <ChatRoomPage slug="dm_1" user={user} onNavigate={vi.fn()} />,
    );
    const chatLog = container.querySelector(
      '[aria-live="polite"]',
    ) as HTMLDivElement;

    const scrollWrites: number[] = [];
    let scrollTopValue = 0;
    Object.defineProperty(chatLog, "scrollTop", {
      configurable: true,
      get: () => scrollTopValue,
      set: (value: number) => {
        scrollTopValue = value;
        scrollWrites.push(value);
      },
    });
    Object.defineProperty(chatLog, "scrollHeight", {
      configurable: true,
      get: () => 1200,
    });
    Object.defineProperty(chatLog, "clientHeight", {
      configurable: true,
      get: () => 400,
    });

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 260));
    });

    expect(scrollWrites.filter((value) => value === 1200)).toHaveLength(1);
    expect(chatLog.querySelector("[data-unread-divider]")).toBeNull();
  });

  it("does not jump to bottom while positioning to first unread on enter", async () => {
    chatRoomMock.details = {
      slug: "dm_1",
      name: "dm",
      kind: "direct",
      created: false,
      createdBy: null,
      peer: { username: "alice", profileImage: null, lastSeen: null },
      lastReadMessageId: 0,
    } as RoomDetails;
    chatRoomMock.messages = [
      makeForeignMessage(1, "first"),
      makeForeignMessage(2, "second"),
      makeForeignMessage(3, "third"),
    ];

    const { container } = render(
      <ChatRoomPage slug="dm_1" user={user} onNavigate={vi.fn()} />,
    );
    const chatLog = container.querySelector(
      '[aria-live="polite"]',
    ) as HTMLDivElement;

    const scrollWrites: number[] = [];
    let scrollTopValue = 0;
    Object.defineProperty(chatLog, "scrollTop", {
      configurable: true,
      get: () => scrollTopValue,
      set: (value: number) => {
        scrollTopValue = value;
        scrollWrites.push(value);
      },
    });
    Object.defineProperty(chatLog, "scrollHeight", {
      configurable: true,
      get: () => 1200,
    });
    Object.defineProperty(chatLog, "clientHeight", {
      configurable: true,
      get: () => 400,
    });

    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    const scrollIntoViewSpy = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoViewSpy,
    });

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 260));
    });

    if (originalScrollIntoView) {
      Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
        configurable: true,
        value: originalScrollIntoView,
      });
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
    }

    expect(scrollIntoViewSpy).toHaveBeenCalled();
    expect(scrollWrites).not.toContain(1200);
  });

  it("does not inherit unread divider from previous slug while next chat is loading", async () => {
    chatRoomMock.details = {
      slug: "dm_1",
      name: "dm",
      kind: "direct",
      created: false,
      createdBy: null,
      peer: { username: "alice", profileImage: null, lastSeen: null },
      lastReadMessageId: 0,
    } as RoomDetails;
    chatRoomMock.messages = [
      makeForeignMessage(1, "first"),
      makeForeignMessage(2, "second"),
    ];
    chatRoomMock.loading = false;

    const { container, rerender } = render(
      <ChatRoomPage slug="dm_1" user={user} onNavigate={vi.fn()} />,
    );
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 260));
    });

    const dividerInFirstChat = container.querySelector<HTMLElement>(
      "[data-unread-divider]",
    );
    expect(dividerInFirstChat).not.toBeNull();
    expect(dividerInFirstChat?.dataset.unreadAnchorId).toBe("1");

    chatRoomMock.loading = true;
    rerender(<ChatRoomPage slug="dm_2" user={user} onNavigate={vi.fn()} />);
    expect(container.querySelector("[data-unread-divider]")).toBeNull();

    chatRoomMock.loading = false;
    chatRoomMock.details = {
      slug: "dm_2",
      name: "dm2",
      kind: "direct",
      created: false,
      createdBy: null,
      peer: { username: "bob", profileImage: null, lastSeen: null },
      lastReadMessageId: 2,
    } as RoomDetails;
    chatRoomMock.messages = [
      makeForeignMessage(1, "other-first"),
      makeForeignMessage(2, "other-second"),
    ];
    rerender(<ChatRoomPage slug="dm_2" user={user} onNavigate={vi.fn()} />);

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 260));
    });

    expect(container.querySelector("[data-unread-divider]")).toBeNull();
  });

  it("does not auto-reposition on non-append message updates", async () => {
    chatRoomMock.details = {
      slug: "dm_1",
      name: "dm",
      kind: "direct",
      created: false,
      createdBy: null,
      peer: { username: "alice", profileImage: null, lastSeen: null },
      lastReadMessageId: 0,
    } as RoomDetails;
    chatRoomMock.messages = [
      makeForeignMessage(1, "first"),
      makeForeignMessage(2, "second"),
    ];

    const { container } = render(
      <ChatRoomPage slug="dm_1" user={user} onNavigate={vi.fn()} />,
    );
    const chatLog = container.querySelector(
      '[aria-live="polite"]',
    ) as HTMLDivElement;

    const scrollWrites: number[] = [];
    let scrollTopValue = 160;
    Object.defineProperty(chatLog, "scrollTop", {
      configurable: true,
      get: () => scrollTopValue,
      set: (value: number) => {
        scrollTopValue = value;
        scrollWrites.push(value);
      },
    });
    Object.defineProperty(chatLog, "scrollHeight", {
      configurable: true,
      value: 1200,
    });
    Object.defineProperty(chatLog, "clientHeight", {
      configurable: true,
      value: 400,
    });
    Object.defineProperty(chatLog, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ bottom: 260 }),
    });
    chatLog
      .querySelectorAll<HTMLElement>("article[data-message-id]")
      .forEach((node, index) => {
        Object.defineProperty(node, "getBoundingClientRect", {
          configurable: true,
          value: () => ({ bottom: 140 + index * 80 }),
        });
      });

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 260));
    });
    scrollTopValue = 160;
    fireEvent.scroll(chatLog);
    const writesBeforeEdit = scrollWrites.length;

    act(() => {
      wsState.options?.onMessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({
            type: "message_edit",
            messageId: 1,
            content: "edited",
            editedAt: "2026-02-13T12:05:00.000Z",
            editedBy: "alice",
          }),
        }),
      );
    });

    expect(scrollWrites.length).toBe(writesBeforeEdit);
    expect(scrollTopValue).toBe(160);
  });

  it("group chat: performs a single initial scroll to bottom when unread messages are absent", async () => {
    chatRoomMock.details = {
      slug: "g-team",
      name: "Team",
      kind: "group",
      created: false,
      createdBy: "owner",
      lastReadMessageId: 3,
      isPublic: false,
    } as RoomDetails;
    chatRoomMock.messages = [
      makeForeignMessage(1, "first"),
      makeForeignMessage(2, "second"),
      makeForeignMessage(3, "third"),
    ];

    const { container } = render(
      <ChatRoomPage slug="g-team" user={user} onNavigate={vi.fn()} />,
    );
    const chatLog = container.querySelector(
      '[aria-live="polite"]',
    ) as HTMLDivElement;

    const scrollWrites: number[] = [];
    let scrollTopValue = 0;
    Object.defineProperty(chatLog, "scrollTop", {
      configurable: true,
      get: () => scrollTopValue,
      set: (value: number) => {
        scrollTopValue = value;
        scrollWrites.push(value);
      },
    });
    Object.defineProperty(chatLog, "scrollHeight", {
      configurable: true,
      get: () => 1200,
    });
    Object.defineProperty(chatLog, "clientHeight", {
      configurable: true,
      get: () => 400,
    });

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 260));
    });

    expect(scrollWrites.filter((value) => value === 1200)).toHaveLength(1);
    expect(chatLog.querySelector("[data-unread-divider]")).toBeNull();
  });

  it("group chat: does not jump to bottom while positioning to first unread on enter", async () => {
    chatRoomMock.details = {
      slug: "g-team",
      name: "Team",
      kind: "group",
      created: false,
      createdBy: "owner",
      lastReadMessageId: 0,
      isPublic: false,
    } as RoomDetails;
    chatRoomMock.messages = [
      makeForeignMessage(1, "first"),
      makeForeignMessage(2, "second"),
      makeForeignMessage(3, "third"),
    ];

    const { container } = render(
      <ChatRoomPage slug="g-team" user={user} onNavigate={vi.fn()} />,
    );
    const chatLog = container.querySelector(
      '[aria-live="polite"]',
    ) as HTMLDivElement;

    const scrollWrites: number[] = [];
    let scrollTopValue = 0;
    Object.defineProperty(chatLog, "scrollTop", {
      configurable: true,
      get: () => scrollTopValue,
      set: (value: number) => {
        scrollTopValue = value;
        scrollWrites.push(value);
      },
    });
    Object.defineProperty(chatLog, "scrollHeight", {
      configurable: true,
      get: () => 1200,
    });
    Object.defineProperty(chatLog, "clientHeight", {
      configurable: true,
      get: () => 400,
    });

    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    const scrollIntoViewSpy = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoViewSpy,
    });

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 260));
    });

    if (originalScrollIntoView) {
      Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
        configurable: true,
        value: originalScrollIntoView,
      });
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
    }

    expect(scrollIntoViewSpy).toHaveBeenCalled();
    expect(scrollWrites).not.toContain(1200);
  });

  it("group chat: ignores non-user scroll events for loadMore on enter", async () => {
    chatRoomMock.details = {
      slug: "g-team",
      name: "Team",
      kind: "group",
      created: false,
      createdBy: "owner",
      lastReadMessageId: 0,
      isPublic: false,
    } as RoomDetails;
    chatRoomMock.messages = [
      makeForeignMessage(1, "first"),
      makeForeignMessage(2, "second"),
    ];
    chatRoomMock.hasMore = true;
    chatRoomMock.loading = false;
    chatRoomMock.loadingMore = false;

    const { container } = render(
      <ChatRoomPage slug="g-team" user={user} onNavigate={vi.fn()} />,
    );
    const chatLog = container.querySelector(
      '[aria-live="polite"]',
    ) as HTMLDivElement;

    Object.defineProperty(chatLog, "scrollTop", {
      configurable: true,
      value: 0,
      writable: true,
    });
    Object.defineProperty(chatLog, "scrollHeight", {
      configurable: true,
      value: 1200,
    });
    Object.defineProperty(chatLog, "clientHeight", {
      configurable: true,
      value: 400,
    });
    Object.defineProperty(chatLog, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ bottom: 260 }),
    });
    chatLog
      .querySelectorAll<HTMLElement>("article[data-message-id]")
      .forEach((node, index) => {
        Object.defineProperty(node, "getBoundingClientRect", {
          configurable: true,
          value: () => ({ bottom: 140 + index * 80 }),
        });
      });

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 260));
    });

    fireEvent.scroll(chatLog);
    expect(chatRoomMock.loadMore).not.toHaveBeenCalled();
  });

  it("flushes pending read with sendBeacon on pagehide", async () => {
    chatRoomMock.details = {
      slug: "dm_1",
      name: "DM",
      kind: "direct",
      created: false,
      createdBy: null,
      lastReadMessageId: 0,
    } as RoomDetails;
    chatRoomMock.messages = [];
    window.sessionStorage.setItem("chat.pendingRead.dm_1", "5");

    const sendBeaconSpy = vi.fn().mockReturnValue(true);
    Object.defineProperty(window.navigator, "sendBeacon", {
      configurable: true,
      value: sendBeaconSpy,
    });

    render(<ChatRoomPage slug="dm_1" user={user} onNavigate={vi.fn()} />);

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 260));
    });

    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });

    expect(sendBeaconSpy).toHaveBeenCalled();
    const [url, payload] = sendBeaconSpy.mock.calls.at(-1) as [
      string,
      FormData,
    ];
    expect(url).toBe("/api/chat/rooms/dm_1/read/");
    expect(payload).toBeInstanceOf(FormData);
    expect(payload.get("lastReadMessageId")).toBe("5");
  });

  it("falls back to fetch keepalive when sendBeacon is unavailable", async () => {
    chatRoomMock.details = {
      slug: "dm_1",
      name: "DM",
      kind: "direct",
      created: false,
      createdBy: null,
      lastReadMessageId: 0,
    } as RoomDetails;
    chatRoomMock.messages = [];
    window.sessionStorage.setItem("chat.pendingRead.dm_1", "6");

    const sendBeaconSpy = vi.fn().mockReturnValue(false);
    Object.defineProperty(window.navigator, "sendBeacon", {
      configurable: true,
      value: sendBeaconSpy,
    });

    const fetchSpy = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);

    const previousVisibilityState = Object.getOwnPropertyDescriptor(
      document,
      "visibilityState",
    );
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });

    render(<ChatRoomPage slug="dm_1" user={user} onNavigate={vi.fn()} />);

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 260));
    });

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(sendBeaconSpy).toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/chat/rooms/dm_1/read/",
      expect.objectContaining({
        method: "POST",
        keepalive: true,
        credentials: "same-origin",
      }),
    );

    if (previousVisibilityState) {
      Object.defineProperty(
        document,
        "visibilityState",
        previousVisibilityState,
      );
    }
    vi.unstubAllGlobals();
  });

  it("smoothly scrolls to bottom after sending own message", () => {
    const { container } = render(
      <ChatRoomPage slug="public" user={user} onNavigate={vi.fn()} />,
    );
    const chatLog = container.querySelector(
      '[aria-live="polite"]',
    ) as HTMLDivElement;
    expect(chatLog).toBeTruthy();

    const scrollToSpy = vi.fn();
    Object.defineProperty(chatLog, "scrollTo", {
      configurable: true,
      value: scrollToSpy,
    });
    Object.defineProperty(chatLog, "scrollHeight", {
      configurable: true,
      value: 840,
    });

    fireEvent.change(screen.getByLabelText("Сообщение"), {
      target: { value: "scroll test" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Отправить сообщение" }),
    );

    expect(scrollToSpy).toHaveBeenCalledWith({ top: 840, behavior: "smooth" });
  });
});
