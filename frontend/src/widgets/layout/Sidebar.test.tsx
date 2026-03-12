import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import type { UserProfile } from "../../entities/user/types";
import { Sidebar } from "./Sidebar";

const directInboxMock = vi.hoisted(() => ({
  unreadDialogsCount: 0,
}));

const conversationListMock = vi.hoisted(() => ({
  searchQuery: "",
  setSearchQuery: vi.fn(),
}));

vi.mock("../../shared/directInbox", () => ({
  useDirectInbox: () => directInboxMock,
}));

vi.mock("../../shared/conversationList/ConversationListProvider", () => ({
  useConversationList: () => conversationListMock,
}));

vi.mock("../sidebar/ConversationList", () => ({
  ConversationList: () => <div data-testid="conversation-list" />,
}));

const user: UserProfile = {
  name: "Demo",
  last_name: "",
  username: "demo",
  email: "demo@example.com",
  profileImage: null,
  avatarCrop: null,
  bio: "",
  lastSeen: null,
  registeredAt: null,
};

describe("Sidebar", () => {
  it("shows @username in footer user block", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Sidebar user={user} onNavigate={vi.fn()} onLogout={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByText("@demo")).toBeInTheDocument();
  });

  it("shows @username in drawer header", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Sidebar user={user} onNavigate={vi.fn()} onLogout={vi.fn()} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Меню" }));
    expect(screen.getAllByText("@demo")).toHaveLength(2);
  });
});
