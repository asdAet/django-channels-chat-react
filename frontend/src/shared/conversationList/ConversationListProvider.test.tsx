import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const chatMock = vi.hoisted(() => ({
  getUnreadCounts:
    vi.fn<() => Promise<Array<{ roomSlug: string; unreadCount: number }>>>(),
  globalSearch: vi.fn<
    (query: string) => Promise<{
      users: Array<{
        username: string;
        profileImage: string | null;
        avatarCrop: null;
        lastSeen: null;
      }>;
      groups: Array<{
        slug: string;
        name: string;
        description: string;
        username: string | null;
        memberCount: number;
        isPublic: boolean;
      }>;
      messages: Array<{
        id: number;
        username: string;
        content: string;
        createdAt: string;
        roomSlug: string;
        roomName: string;
        roomKind: "public" | "private" | "direct" | "group";
      }>;
    }>
  >(),
}));

const groupMock = vi.hoisted(() => ({
  getMyGroups: vi.fn<
    () => Promise<{
      items: Array<{
        slug: string;
        name: string;
        description: string;
        username: string | null;
        memberCount: number;
        avatarUrl?: string | null;
        avatarCrop?: null;
      }>;
      total: number;
    }>
  >(),
}));

vi.mock("../../controllers/ChatController", () => ({
  chatController: chatMock,
}));

vi.mock("../../controllers/GroupController", () => ({
  groupController: groupMock,
}));

vi.mock("../directInbox", () => ({
  useDirectInbox: () => ({
    items: [],
    unreadCounts: {},
  }),
}));

vi.mock("../presence", () => ({
  usePresence: () => ({
    online: [],
    status: "offline",
  }),
}));

vi.mock("../unreadOverrides/store", () => ({
  useUnreadOverrides: () => ({}),
}));

import {
  ConversationListProvider,
  useConversationList,
} from "./ConversationListProvider";

const user = {
  username: "demo",
  email: "demo@example.com",
  profileImage: null,
  bio: "",
  lastSeen: null,
  registeredAt: null,
};

function Probe() {
  const { setSearchQuery } = useConversationList();
  return (
    <div>
      <button type="button" onClick={() => setSearchQuery("@a")}>
        short-handle
      </button>
      <button type="button" onClick={() => setSearchQuery("@ab")}>
        valid-handle
      </button>
    </div>
  );
}

describe("ConversationListProvider global search validation", () => {
  beforeEach(() => {
    chatMock.getUnreadCounts.mockReset().mockResolvedValue([]);
    chatMock.globalSearch
      .mockReset()
      .mockResolvedValue({ users: [], groups: [], messages: [] });
    groupMock.getMyGroups
      .mockReset()
      .mockResolvedValue({ items: [], total: 0 });
  });

  it("does not call global search for too short @handle query", async () => {
    render(
      <ConversationListProvider user={user} ready>
        <Probe />
      </ConversationListProvider>,
    );

    await waitFor(() => {
      expect(chatMock.getUnreadCounts).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "short-handle" }));
    await new Promise((resolve) => setTimeout(resolve, 350));

    expect(chatMock.globalSearch).not.toHaveBeenCalled();
  });

  it("calls global search for valid @handle query", async () => {
    render(
      <ConversationListProvider user={user} ready>
        <Probe />
      </ConversationListProvider>,
    );

    await waitFor(() => {
      expect(chatMock.getUnreadCounts).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "valid-handle" }));
    await new Promise((resolve) => setTimeout(resolve, 350));

    await waitFor(() => {
      expect(chatMock.globalSearch).toHaveBeenCalledWith("@ab");
    });
  });
});
