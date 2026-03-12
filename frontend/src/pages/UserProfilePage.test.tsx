import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UserProfile } from "../entities/user/types";

const profileMock = vi.hoisted(() => ({
  user: {
    username: "alice",
    email: "",
    profileImage: null,
    avatarCrop: null,
    bio: "",
    lastSeen: null as string | null,
    registeredAt: null,
  } as UserProfile,
  loading: false,
  error: null as string | null,
}));

vi.mock("../hooks/useUserProfile", () => ({
  useUserProfile: () => profileMock,
}));

const presenceMock = vi.hoisted(() => ({
  online: [] as Array<{ username: string; profileImage: string | null }>,
  guests: 0,
  status: "online" as const,
  lastError: null as string | null,
}));

vi.mock("../shared/presence", () => ({
  usePresence: () => presenceMock,
}));

import { UserProfilePage } from "./UserProfilePage";

const makeUser = (username: string) =>
  ({
    username,
    email: `${username}@example.com`,
    profileImage: null,
    avatarCrop: null,
    bio: "",
    lastSeen: null as string | null,
    registeredAt: null,
  }) as UserProfile;

describe("UserProfilePage", () => {
  beforeEach(() => {
    profileMock.user = {
      username: "alice",
      email: "",
      profileImage: null,
      avatarCrop: null,
      bio: "",
      lastSeen: null as string | null,
      registeredAt: null,
    };
    profileMock.loading = false;
    profileMock.error = null;
    presenceMock.online = [];
    presenceMock.status = "online";
    presenceMock.lastError = null;
  });

  it("shows send message button only for foreign profile", () => {
    const onNavigate = vi.fn();
    render(
      <UserProfilePage
        user={makeUser("bob")}
        currentUser={makeUser("bob")}
        username="alice"
        onNavigate={onNavigate}
        onLogout={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("send-dm-button"));
    expect(onNavigate).toHaveBeenCalledWith("/@alice");
  });

  it("shows @username under profile name", () => {
    render(
      <UserProfilePage
        user={makeUser("bob")}
        currentUser={makeUser("bob")}
        username="alice"
        onNavigate={vi.fn()}
        onLogout={vi.fn()}
      />,
    );

    expect(screen.getByText("@alice")).toBeInTheDocument();
  });

  it("hides bio block when bio is empty", () => {
    render(
      <UserProfilePage
        user={makeUser("bob")}
        currentUser={makeUser("bob")}
        username="alice"
        onNavigate={vi.fn()}
        onLogout={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("profile-bio-section")).toBeNull();
  });

  it("hides send message button for own profile", () => {
    render(
      <UserProfilePage
        user={makeUser("alice")}
        currentUser={makeUser("alice")}
        username="alice"
        onNavigate={vi.fn()}
        onLogout={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("send-dm-button")).toBeNull();
  });

  it("shows online label when user is online", () => {
    presenceMock.online = [{ username: "alice", profileImage: null }];
    const { container } = render(
      <UserProfilePage
        user={makeUser("bob")}
        currentUser={makeUser("bob")}
        username="alice"
        onNavigate={vi.fn()}
        onLogout={vi.fn()}
      />,
    );

    expect(container.querySelector('[data-online="true"]')).not.toBeNull();
  });

  it("shows last seen label when user is offline", () => {
    profileMock.user = {
      username: "alice",
      email: "",
      profileImage: null,
      avatarCrop: null,
      bio: "",
      lastSeen: "2026-02-13T10:00:00.000Z",
      registeredAt: null,
    };

    const { container } = render(
      <UserProfilePage
        user={makeUser("bob")}
        currentUser={makeUser("bob")}
        username="alice"
        onNavigate={vi.fn()}
        onLogout={vi.fn()}
      />,
    );

    expect(container.querySelector('[data-online="true"]')).toBeNull();
  });

  it("shows original image in fullscreen preview even when avatarCrop exists", () => {
    profileMock.user = {
      username: "alice",
      email: "",
      profileImage: "https://cdn.example.com/alice.jpg",
      avatarCrop: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
      bio: "",
      lastSeen: null,
      registeredAt: null,
    };

    const { container } = render(
      <UserProfilePage
        user={makeUser("bob")}
        currentUser={makeUser("bob")}
        username="alice"
        onNavigate={vi.fn()}
        onLogout={vi.fn()}
      />,
    );

    const openPreviewButton = screen.getByTestId("profile-avatar-open");
    fireEvent.click(openPreviewButton);

    const dialog = screen.getByRole("dialog");
    const lightboxImage = dialog.querySelector("img");
    expect(lightboxImage?.getAttribute("src")).toBe(
      "https://cdn.example.com/alice.jpg",
    );
    expect(lightboxImage?.style.width).toBe("");

    const circleImage = container.querySelector("[data-online] img");
    expect(circleImage).not.toBeNull();
  });
});
