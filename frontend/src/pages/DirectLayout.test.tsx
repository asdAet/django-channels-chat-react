import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./DirectChatByUsernamePage", () => ({
  DirectChatByUsernamePage: ({ username }: { username: string }) => (
    <div>CHAT:{username}</div>
  ),
}));

import { DirectLayout } from "./DirectLayout";

const user = {
  username: "demo",
  email: "demo@example.com",
  profileImage: null,
  bio: "",
  lastSeen: null,
  registeredAt: null,
};

describe("DirectLayout", () => {
  it("shows placeholder when no active chat", () => {
    render(<DirectLayout user={user} onNavigate={vi.fn()} />);
    expect(
      screen.getByText("�������� ������ � ������� ������, ����� ������� ���."),
    ).toBeInTheDocument();
  });

  it("shows chat when username is provided", () => {
    render(<DirectLayout user={user} username="alice" onNavigate={vi.fn()} />);
    expect(screen.getByText("CHAT:alice")).toBeInTheDocument();
  });
});
