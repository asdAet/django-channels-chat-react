import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const profileMock = vi.hoisted(() => ({
  user: {
    name: "Алиса",
    last_name: "",
    username: "alice",
    profileImage: null,
    avatarCrop: null,
    lastSeen: "2026-03-12T12:00:00.000Z" as string | null,
    bio: "",
  },
  loading: false,
  error: null as string | null,
}));

const presenceMock = vi.hoisted(() => ({
  online: [] as Array<{ username: string; profileImage: string | null }>,
  guests: 0,
  status: "online" as const,
  lastError: null as string | null,
}));

const relationState = vi.hoisted(() => ({
  friends: [] as Array<{ id: number; userId: number; username: string }>,
  incoming: [] as Array<{
    id: number;
    userId: number;
    username: string;
    createdAt: string;
  }>,
  outgoing: [] as Array<{
    id: number;
    userId: number;
    username: string;
    createdAt: string;
  }>,
  blocked: [] as Array<{ id: number; userId: number; username: string }>,
}));

const friendsControllerMock = vi.hoisted(() => ({
  getFriends: vi.fn(async () => relationState.friends),
  getIncomingRequests: vi.fn(async () => relationState.incoming),
  getOutgoingRequests: vi.fn(async () => relationState.outgoing),
  getBlockedUsers: vi.fn(async () => relationState.blocked),
  sendFriendRequest: vi.fn(async (username: string) => {
    relationState.outgoing = [
      { id: 101, userId: 10, username, createdAt: "2026-03-12T12:00:00.000Z" },
    ];
  }),
  cancelOutgoingFriendRequest: vi.fn(async () => {
    relationState.outgoing = [];
  }),
  acceptFriendRequest: vi.fn(async () => {
    relationState.incoming = [];
    relationState.friends = [{ id: 102, userId: 10, username: "alice" }];
  }),
  declineFriendRequest: vi.fn(async () => {
    relationState.incoming = [];
  }),
  removeFriend: vi.fn(async () => {
    relationState.friends = [];
  }),
  blockUser: vi.fn(async (username: string) => {
    relationState.friends = [];
    relationState.incoming = [];
    relationState.outgoing = [];
    relationState.blocked = [{ id: 201, userId: 10, username }];
  }),
  unblockUser: vi.fn(async () => {
    relationState.blocked = [];
  }),
}));

vi.mock("../../hooks/useUserProfile", () => ({
  useUserProfile: () => profileMock,
}));

vi.mock("../../shared/presence", () => ({
  usePresence: () => presenceMock,
}));

vi.mock("../../controllers/FriendsController", () => ({
  friendsController: friendsControllerMock,
}));

import { UserProfilePanel } from "./UserProfilePanel";

describe("UserProfilePanel", () => {
  beforeEach(() => {
    profileMock.loading = false;
    profileMock.error = null;
    profileMock.user = {
      name: "Алиса",
      last_name: "",
      username: "alice",
      profileImage: null,
      avatarCrop: null,
      lastSeen: "2026-03-12T12:00:00.000Z",
      bio: "",
    };
    presenceMock.online = [];
    presenceMock.status = "online";
    relationState.friends = [];
    relationState.incoming = [];
    relationState.outgoing = [];
    relationState.blocked = [];
    vi.clearAllMocks();
  });

  it("shows online status from presence and renders @username", async () => {
    presenceMock.online = [{ username: "alice", profileImage: null }];

    render(
      <MemoryRouter>
        <UserProfilePanel username="alice" currentUsername="bob" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("@alice")).toBeInTheDocument();
      expect(screen.getByText("В сети")).toBeInTheDocument();
    });
  });

  it("hides bio block when bio is empty", async () => {
    render(
      <MemoryRouter>
        <UserProfilePanel username="alice" currentUsername="bob" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.queryByText("О себе")).toBeNull();
    });
  });

  it("handles add friend -> cancel outgoing flow", async () => {
    render(
      <MemoryRouter>
        <UserProfilePanel username="alice" currentUsername="bob" />
      </MemoryRouter>,
    );

    const addButton = await screen.findByRole("button", {
      name: "Добавить в друзья",
    });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(friendsControllerMock.sendFriendRequest).toHaveBeenCalledWith(
        "alice",
      );
      expect(
        screen.getByRole("button", { name: "Отменить запрос" }),
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Отменить запрос" }),
    );
    await waitFor(() => {
      expect(
        friendsControllerMock.cancelOutgoingFriendRequest,
      ).toHaveBeenCalled();
      expect(
        screen.getByRole("button", {
          name: "Добавить в друзья",
        }),
      ).toBeInTheDocument();
    });
  });

  it("shows only unblock action for blocked relation", async () => {
    relationState.blocked = [{ id: 201, userId: 10, username: "alice" }];

    render(
      <MemoryRouter>
        <UserProfilePanel username="alice" currentUsername="bob" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Разблокировать" }),
      ).toBeInTheDocument();
    });

    expect(
      screen.queryByRole("button", {
        name: "Написать сообщение",
      }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", {
        name: "Добавить в друзья",
      }),
    ).toBeNull();
  });

  it("hides friend actions for self profile", async () => {
    render(
      <MemoryRouter>
        <UserProfilePanel username="alice" currentUsername="alice" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.queryByRole("button", {
          name: "Добавить в друзья",
        }),
      ).toBeNull();
      expect(
        screen.queryByRole("button", {
          name: "Написать сообщение",
        }),
      ).toBeNull();
    });
  });
});
