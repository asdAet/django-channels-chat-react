import type { ReactNode } from "react";

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Group } from "../../entities/group/types";

const groupControllerMock = vi.hoisted(() => ({
  getGroupDetails: vi.fn(),
  getGroupMembers: vi.fn(),
  getInvites: vi.fn(),
  getJoinRequests: vi.fn(),
  getBannedMembers: vi.fn(),
  updateGroup: vi.fn(),
  leaveGroup: vi.fn(),
  deleteGroup: vi.fn(),
  createInvite: vi.fn(),
  revokeInvite: vi.fn(),
  kickMember: vi.fn(),
  banMember: vi.fn(),
  muteMember: vi.fn(),
  unmuteMember: vi.fn(),
  approveJoinRequest: vi.fn(),
  rejectJoinRequest: vi.fn(),
  unbanMember: vi.fn(),
}));

const rolesControllerMock = vi.hoisted(() => ({
  getRoomRoles: vi.fn(),
  getRoomOverrides: vi.fn(),
  getMemberRoles: vi.fn(),
  createRoomRole: vi.fn(),
  updateRoomRole: vi.fn(),
  deleteRoomRole: vi.fn(),
  setMemberRoles: vi.fn(),
  createRoomOverride: vi.fn(),
  updateRoomOverride: vi.fn(),
  deleteRoomOverride: vi.fn(),
}));

const chatControllerMock = vi.hoisted(() => ({
  getRoomAttachments: vi.fn(),
  getRoomMessages: vi.fn(),
}));

const roomPermissionsMock = vi.hoisted(() => ({
  loading: false,
  raw: null,
  isMember: true,
  isBanned: false,
  canJoin: false,
  canRead: true,
  canWrite: true,
  canAttachFiles: true,
  canReact: true,
  canManageMessages: true,
  canManageRoles: true,
  canManageRoom: true,
  canKick: true,
  canBan: true,
  canInvite: true,
  canMute: true,
  isAdmin: true,
  refresh: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../controllers/GroupController", () => ({
  groupController: groupControllerMock,
}));

vi.mock("../../controllers/RolesController", () => ({
  rolesController: rolesControllerMock,
}));

vi.mock("../../controllers/ChatController", () => ({
  chatController: chatControllerMock,
}));

vi.mock("../../hooks/useRoomPermissions", () => ({
  useRoomPermissions: () => roomPermissionsMock,
}));

vi.mock("../../shared/ui", () => ({
  Avatar: ({ username }: { username: string }) => (
    <div data-testid="avatar">{username}</div>
  ),
  Modal: ({
    open,
    children,
    title,
  }: {
    open: boolean;
    children: ReactNode;
    title: string;
  }) =>
    open ? (
      <div data-testid="modal">
        {title}
        {children}
      </div>
    ) : null,
  Spinner: () => <div data-testid="spinner" />,
  AvatarCropModal: ({
    open,
    onCancel,
    onApply,
  }: {
    open: boolean;
    image: string | null;
    onCancel: () => void;
    onApply: (crop: {
      x: number;
      y: number;
      width: number;
      height: number;
    }) => void;
  }) =>
    open ? (
      <div data-testid="avatar-crop-modal">
        <button
          type="button"
          onClick={() => onApply({ x: 0.1, y: 0.2, width: 0.5, height: 0.5 })}
        >
          apply-crop
        </button>
        <button type="button" onClick={onCancel}>
          cancel-crop
        </button>
      </div>
    ) : null,
}));

import { GroupInfoPanel } from "./GroupInfoPanel";

const sampleGroup: Group = {
  slug: "test-group",
  name: "Test Group",
  description: "Test description",
  isPublic: true,
  username: "testgroup",
  memberCount: 3,
  slowModeSeconds: 0,
  joinApprovalRequired: false,
  createdBy: "owner",
  avatarUrl: null,
  avatarCrop: null,
};

const withBaseMocks = () => {
  groupControllerMock.getGroupMembers.mockResolvedValue({
    items: [],
    total: 0,
  });
  rolesControllerMock.getRoomRoles.mockResolvedValue([]);
  rolesControllerMock.getRoomOverrides.mockResolvedValue([]);
  rolesControllerMock.getMemberRoles.mockResolvedValue({ roleIds: [] });
  chatControllerMock.getRoomAttachments.mockResolvedValue({
    items: [],
    pagination: { limit: 120, hasMore: false, nextBefore: null },
  });
  chatControllerMock.getRoomMessages.mockResolvedValue({
    messages: [],
    pagination: { limit: 100, hasMore: false, nextBefore: null },
  });
};

describe("GroupInfoPanel", () => {
  beforeEach(() => {
    groupControllerMock.getGroupDetails.mockReset();
    groupControllerMock.getGroupMembers.mockReset();
    groupControllerMock.getInvites.mockReset();
    groupControllerMock.getJoinRequests.mockReset();
    groupControllerMock.getBannedMembers.mockReset();
    groupControllerMock.updateGroup.mockReset();
    rolesControllerMock.getRoomRoles.mockReset();
    rolesControllerMock.getRoomOverrides.mockReset();
    rolesControllerMock.getMemberRoles.mockReset();
    chatControllerMock.getRoomAttachments.mockReset();
    chatControllerMock.getRoomMessages.mockReset();
    roomPermissionsMock.loading = false;
    roomPermissionsMock.raw = null;
    roomPermissionsMock.isMember = true;
    roomPermissionsMock.isBanned = false;
    roomPermissionsMock.canJoin = false;
    roomPermissionsMock.canRead = true;
    roomPermissionsMock.canWrite = true;
    roomPermissionsMock.canAttachFiles = true;
    roomPermissionsMock.canReact = true;
    roomPermissionsMock.canManageMessages = true;
    roomPermissionsMock.canManageRoles = true;
    roomPermissionsMock.canManageRoom = true;
    roomPermissionsMock.canKick = true;
    roomPermissionsMock.canBan = true;
    roomPermissionsMock.canInvite = true;
    roomPermissionsMock.canMute = true;
    roomPermissionsMock.isAdmin = true;
    roomPermissionsMock.refresh.mockReset().mockResolvedValue(undefined);

    withBaseMocks();
  });

  it("renders loading first and then group info without crashing", async () => {
    let resolveGroup: ((value: Group) => void) | null = null;
    const groupPromise = new Promise<Group>((resolve) => {
      resolveGroup = resolve;
    });
    groupControllerMock.getGroupDetails.mockReturnValue(groupPromise);

    render(<GroupInfoPanel slug="test-group" />);

    expect(screen.getByTestId("spinner")).toBeInTheDocument();

    await act(async () => {
      resolveGroup?.(sampleGroup);
    });

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Test Group" }),
      ).toBeInTheDocument();
    });
    expect(screen.getByTestId("group-quick-media")).toBeInTheDocument();
    expect(screen.getByTestId("group-quick-settings")).toBeInTheDocument();
    expect(screen.getByTestId("group-quick-invites")).toBeInTheDocument();
  });

  it("renders unavailable state when group details request fails", async () => {
    groupControllerMock.getGroupDetails.mockRejectedValue(new Error("boom"));

    render(<GroupInfoPanel slug="test-group" />);

    await waitFor(() => {
      expect(screen.getByText("Группа недоступна.")).toBeInTheDocument();
    });
  });

  it("hides self moderation actions in members view", async () => {
    groupControllerMock.getGroupDetails.mockResolvedValue(sampleGroup);
    groupControllerMock.getGroupMembers.mockResolvedValue({
      items: [
        {
          userId: 1,
          username: "self_user",
          nickname: "",
          profileImage: null,
          avatarCrop: null,
          roles: ["Owner"],
          joinedAt: "2026-03-10T10:00:00Z",
          isMuted: false,
          isSelf: true,
        },
        {
          userId: 2,
          username: "other_user",
          nickname: "",
          profileImage: null,
          avatarCrop: null,
          roles: ["Member"],
          joinedAt: "2026-03-10T10:10:00Z",
          isMuted: false,
          isSelf: false,
        },
      ],
      total: 2,
    });

    render(<GroupInfoPanel slug="test-group" currentUsername="self_user" />);
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Test Group" }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("group-quick-members"));

    const selfRow = await screen.findByTestId("group-member-1");
    expect(
      within(selfRow).queryByRole("button", { name: "Kick" }),
    ).not.toBeInTheDocument();
    expect(
      within(selfRow).queryByRole("button", { name: "Ban" }),
    ).not.toBeInTheDocument();
    expect(
      within(selfRow).queryByRole("button", { name: "Mute" }),
    ).not.toBeInTheDocument();

    const otherRow = screen.getByTestId("group-member-2");
    expect(
      within(otherRow).getByRole("button", { name: "Kick" }),
    ).toBeInTheDocument();
  });

  it("opens avatar crop modal and sends avatar crop with updateGroup", async () => {
    if (!URL.createObjectURL) {
      Object.defineProperty(URL, "createObjectURL", {
        configurable: true,
        writable: true,
        value: vi.fn(() => "blob:test-group-avatar"),
      });
    } else {
      vi.spyOn(URL, "createObjectURL").mockReturnValue(
        "blob:test-group-avatar",
      );
    }
    if (!URL.revokeObjectURL) {
      Object.defineProperty(URL, "revokeObjectURL", {
        configurable: true,
        writable: true,
        value: vi.fn(),
      });
    }

    groupControllerMock.getGroupDetails.mockResolvedValue(sampleGroup);
    groupControllerMock.updateGroup.mockResolvedValue(sampleGroup);

    render(<GroupInfoPanel slug="test-group" />);
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Test Group" }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("group-quick-settings"));

    const file = new File(["avatar"], "avatar.png", { type: "image/png" });
    fireEvent.change(screen.getByTestId("group-avatar-input"), {
      target: { files: [file] },
    });

    expect(screen.getByTestId("avatar-crop-modal")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "apply-crop" }));
    fireEvent.click(screen.getByTestId("group-save-settings"));

    await waitFor(() => {
      expect(groupControllerMock.updateGroup).toHaveBeenCalled();
    });
    expect(groupControllerMock.updateGroup).toHaveBeenCalledWith(
      "test-group",
      expect.objectContaining({
        avatar: file,
        avatarCrop: { x: 0.1, y: 0.2, width: 0.5, height: 0.5 },
      }),
    );
  });

  it("loads media and links sections", async () => {
    groupControllerMock.getGroupDetails.mockResolvedValue(sampleGroup);
    chatControllerMock.getRoomAttachments.mockResolvedValue({
      items: [
        {
          id: 101,
          originalFilename: "photo.png",
          contentType: "image/png",
          fileSize: 1024,
          url: "https://cdn.test/photo.png",
          thumbnailUrl: "https://cdn.test/photo-thumb.png",
          width: 100,
          height: 100,
          messageId: 50,
          createdAt: "2026-03-10T12:00:00Z",
          username: "owner",
        },
      ],
      pagination: { limit: 120, hasMore: false, nextBefore: null },
    });
    chatControllerMock.getRoomMessages.mockResolvedValue({
      messages: [
        {
          id: 42,
          username: "owner",
          content: "Check this https://example.com/path",
          profilePic: null,
          avatarCrop: null,
          createdAt: "2026-03-10T12:05:00Z",
          editedAt: null,
          isDeleted: false,
          replyTo: null,
          attachments: [],
          reactions: [],
        },
      ],
      pagination: { limit: 100, hasMore: false, nextBefore: null },
    });

    render(<GroupInfoPanel slug="test-group" />);
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Test Group" }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("group-quick-media"));
    await waitFor(() => {
      expect(chatControllerMock.getRoomAttachments).toHaveBeenCalledWith(
        "test-group",
        { limit: 120 },
      );
    });
    expect(screen.getByText("photo.png")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "←" }));
    fireEvent.click(screen.getByTestId("group-quick-links"));
    await waitFor(() => {
      expect(chatControllerMock.getRoomMessages).toHaveBeenCalled();
    });
    expect(screen.getByText("https://example.com/path")).toBeInTheDocument();
  });

  it("does not request roles and overrides without manage roles permission", async () => {
    roomPermissionsMock.canManageRoles = false;
    groupControllerMock.getGroupDetails.mockResolvedValue(sampleGroup);

    render(<GroupInfoPanel slug="test-group" />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Test Group" }),
      ).toBeInTheDocument();
    });

    expect(rolesControllerMock.getRoomRoles).not.toHaveBeenCalled();
    expect(rolesControllerMock.getRoomOverrides).not.toHaveBeenCalled();
  });
});
