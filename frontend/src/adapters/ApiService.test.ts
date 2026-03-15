import { beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";

import { apiService, normalizeAxiosError } from "./ApiService";
import { server } from "../test/setup";

const now = "2026-01-01T00:00:00.000Z";

const friendItem = {
  id: 10,
  user: {
    id: 22,
    username: "alice",
    profileImage: null,
    avatarCrop: null,
  },
  created_at: now,
};

const group = {
  roomId: 101,
  slug: "101",
  name: "Group One",
  description: "group description",
  isPublic: true,
  username: "group_one",
  memberCount: 2,
  slowModeSeconds: 0,
  joinApprovalRequired: false,
  createdBy: "owner",
  avatarUrl: null,
  avatarCrop: null,
};

const groupList = {
  items: [
    {
      roomId: group.roomId,
      slug: group.slug,
      name: group.name,
      description: group.description,
      username: group.username,
      memberCount: group.memberCount,
      avatarUrl: null,
      avatarCrop: null,
    },
  ],
  total: 1,
  pagination: { limit: 20, hasMore: false, nextBefore: null },
};

const invite = {
  code: "INV-123",
  name: "Main invite",
  createdBy: "owner",
  expiresAt: null,
  maxUses: 10,
  useCount: 0,
  isRevoked: false,
  isExpired: false,
  createdAt: now,
};

const roomRole = {
  id: 4,
  name: "Moderator",
  color: "#ffcc00",
  position: 1,
  permissions: 15,
  isDefault: false,
  createdAt: now,
};

const memberRoles = {
  userId: 22,
  username: "alice",
  roleIds: [4],
  roles: ["Moderator"],
  isBanned: false,
  joinedAt: now,
};

const override = {
  id: 6,
  targetRoleId: 4,
  targetUserId: null,
  allow: 8,
  deny: 2,
};

describe("ApiService", () => {
  beforeEach(() => {
    sessionStorage.clear();
    document.cookie =
      "csrftoken=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  });

  it("injects csrf token from cookie into write requests", async () => {
    document.cookie = "csrftoken=cookie-token; path=/";

    let receivedToken: string | null = null;
    server.use(
      http.post("/api/auth/login/", async ({ request }) => {
        receivedToken = request.headers.get("x-csrftoken");
        return HttpResponse.json({ authenticated: true, user: null });
      }),
    );

    await apiService.login("demo@example.com", "pass12345");
    expect(receivedToken).toBe("cookie-token");
  });

  it("stores csrf token in sessionStorage and uses it as fallback", async () => {
    server.use(
      http.get("/api/auth/csrf/", () =>
        HttpResponse.json({ csrfToken: "stored-token" }),
      ),
    );

    await apiService.ensureCsrf();

    let receivedToken: string | null = null;
    server.use(
      http.post("/api/auth/login/", async ({ request }) => {
        receivedToken = request.headers.get("x-csrftoken");
        return HttpResponse.json({ authenticated: true, user: null });
      }),
    );

    await apiService.login("demo@example.com", "pass12345");

    expect(sessionStorage.getItem("csrfToken")).toBe("stored-token");
    expect(receivedToken).toBe("stored-token");
  });

  it("sends multipart form data for profile update", async () => {
    let contentType = "";

    server.use(
      http.patch("*/api/profile/", async ({ request }) => {
        contentType = request.headers.get("content-type") || "";
        return HttpResponse.json({
          user: {
            handle: "updated",
            publicId: "1234567890",
            publicRef: "@updated",
            email: "updated@example.com",
            profileImage: null,
            bio: "about me",
            lastSeen: null,
            registeredAt: null,
          },
        });
      }),
      http.patch("*/api/profile/handle/", () =>
        HttpResponse.json({
          user: {
            name: "updated",
            handle: "updated",
            publicId: "1234567890",
            publicRef: "@updated",
            profileImage: null,
            avatarCrop: null,
            bio: "about me",
            lastSeen: null,
            registeredAt: null,
          },
        }),
      ),
    );

    const response = await apiService.updateProfile({
      username: "updated",
      bio: "about me",
    });

    expect(contentType).toContain("multipart/form-data");
    expect(contentType).not.toContain("application/json");
    expect(response.user.username).toBe("updated");
  });

  it("normalizes axios errors to ApiError shape", async () => {
    server.use(
      http.post("/api/auth/register/", () => {
        return HttpResponse.json(
          { errors: { username: ["already used"] } },
          { status: 400 },
        );
      }),
    );

    await expect(
      apiService.register("taken_login", "pass12345", "pass12345", "Taken User"),
    ).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining("already used"),
      data: expect.objectContaining({ errors: expect.any(Object) }),
    });
  });

  it("normalizes string server errors", async () => {
    server.use(
      http.post(
        "/api/auth/register/",
        () => new HttpResponse("fatal error", { status: 500 }),
      ),
    );

    await expect(
      apiService.register("name_login", "pass12345", "pass12345", "Name User"),
    ).rejects.toMatchObject({
      status: 500,
      message: expect.stringContaining("fatal error"),
    });
  });

  it("normalizes detail payload errors", async () => {
    server.use(
      http.post("/api/auth/login/", () =>
        HttpResponse.json({ detail: "forbidden" }, { status: 403 }),
      ),
    );

    await expect(
      apiService.login("demo@example.com", "pass12345"),
    ).rejects.toMatchObject({
      status: 403,
      message: expect.stringContaining("forbidden"),
      data: expect.objectContaining({ detail: "forbidden" }),
    });
  });

  it("supports read endpoints and room query params", async () => {
    let beforeParam: string | null = null;
    let encodedUserPath = "";
    let sessionCsrfHeader: string | null = "init";

    server.use(
      http.get("/api/auth/session/", ({ request }) => {
        sessionCsrfHeader = request.headers.get("x-csrftoken");
        return HttpResponse.json({ authenticated: false, user: null });
      }),
      http.get("/api/auth/password-rules/", () =>
        HttpResponse.json({ rules: ["min length"] }),
      ),
      http.get("/api/public/resolve/:ref", ({ params }) => {
        encodedUserPath = String(params.ref);
        return HttpResponse.json({
          ownerType: "user",
          ownerId: 77,
          publicRef: "@test",
          user: {
            name: String(params.ref),
            handle: String(params.ref),
            publicId: "1234567890",
            publicRef: `@${String(params.ref)}`,
            profileImage: null,
            bio: "",
            lastSeen: null,
            registeredAt: null,
          },
        });
      }),
      http.get("/api/chat/public-room/", () =>
        HttpResponse.json({
          roomId: 999,
          slug: "public",
          name: "Public",
          kind: "public",
          created: false,
          createdBy: null,
        }),
      ),
      http.get("/api/chat/rooms/:slug/", ({ params }) =>
        HttpResponse.json({
          slug: String(params.slug),
          name: "Room",
          kind: "private",
          created: false,
          createdBy: null,
        }),
      ),
      http.get("/api/chat/rooms/:slug/messages/", ({ request }) => {
        beforeParam = new URL(request.url).searchParams.get("before");
        return HttpResponse.json({
          messages: [],
          pagination: { limit: 50, hasMore: false, nextBefore: null },
        });
      }),
      http.post("/api/auth/logout/", () => HttpResponse.json({ ok: true })),
    );

    const session = await apiService.getSession();
    const rules = await apiService.getPasswordRules();
    const publicRoom = await apiService.getPublicRoom();
    const room = await apiService.getRoomDetails("public");
    const roomMessages = await apiService.getRoomMessages("public", {
      limit: 50,
      beforeId: 123,
    });
    const profile = await apiService.getUserProfile("user name");
    const logout = await apiService.logout();

    expect(session.authenticated).toBe(false);
    expect(sessionCsrfHeader).toBeNull();
    expect(rules.rules).toEqual(["min length"]);
    expect(publicRoom.slug).toBe("public");
    expect(room.slug).toBe("public");
    expect(roomMessages.messages).toEqual([]);
    expect(beforeParam).toBe("123");
    expect(encodedUserPath).toBe("user name");
    expect(profile.user.username).toBe("user name");
    expect(logout.ok).toBe(true);
  });

  it("supports presence-session and client-config endpoints", async () => {
    server.use(
      http.get("/api/auth/presence-session/", () =>
        HttpResponse.json({ ok: true }),
      ),
      http.get("/api/meta/client-config/", () =>
        HttpResponse.json({
          usernameMaxLength: 32,
          chatMessageMaxLength: 4000,
          chatRoomSlugRegex: "^[a-z0-9_-]+$",
          chatAttachmentMaxSizeMb: 10,
          chatAttachmentMaxPerMessage: 5,
          chatAttachmentAllowedTypes: ["text/plain", "audio/mpeg"],
          mediaUrlTtlSeconds: 3600,
          mediaMode: "signed_only",
          googleOAuthClientId: "",
        }),
      ),
    );

    await expect(apiService.ensurePresenceSession()).resolves.toEqual({
      ok: true,
    });
    await expect(apiService.getClientConfig()).resolves.toMatchObject({
      mediaMode: "signed_only",
      googleOAuthClientId: "",
    });
  });

  it("supports oauth google endpoint", async () => {
    let receivedIdToken = "";
    let receivedAccessToken = "";

    server.use(
      http.post("/api/auth/oauth/google/", async ({ request }) => {
        const payload = (await request.json()) as {
          idToken?: string;
          accessToken?: string;
        };
        receivedIdToken = payload.idToken ?? "";
        receivedAccessToken = payload.accessToken ?? "";
        return HttpResponse.json({
          authenticated: true,
          user: {
            name: "Google User",
            handle: "googleuser",
            publicId: "1234567890",
            publicRef: "@googleuser",
            email: "google@example.com",
            profileImage: null,
            avatarCrop: null,
            bio: "",
            lastSeen: null,
            registeredAt: null,
          },
        });
      }),
    );

    const result = await apiService.oauthGoogle("id-token-123");
    expect(result.authenticated).toBe(true);
    expect(receivedIdToken).toBe("id-token-123");

    await apiService.oauthGoogle("access-token-123", "accessToken");
    expect(receivedAccessToken).toBe("access-token-123");
  });

  it("supports friends endpoints", async () => {
    let sentUsername = "";

    server.use(
      http.get("/api/friends/", () =>
        HttpResponse.json({ items: [friendItem] }),
      ),
      http.post("/api/friends/requests/", async ({ request }) => {
        const payload = (await request.json()) as { username?: string };
        sentUsername = payload.username ?? "";
        return HttpResponse.json({ item: friendItem });
      }),
      http.get("/api/friends/requests/incoming/", () =>
        HttpResponse.json({ items: [friendItem] }),
      ),
      http.get("/api/friends/requests/outgoing/", () =>
        HttpResponse.json({ items: [friendItem] }),
      ),
      http.post("/api/friends/requests/:friendshipId/accept/", () =>
        HttpResponse.json({ ok: true }),
      ),
      http.post("/api/friends/requests/:friendshipId/decline/", () =>
        HttpResponse.json({ ok: true }),
      ),
      http.delete("/api/friends/requests/:friendshipId/cancel/", () =>
        HttpResponse.json({ ok: true }),
      ),
      http.delete("/api/friends/:userId/", () =>
        HttpResponse.json({ ok: true }),
      ),
      http.post("/api/friends/block/", () => HttpResponse.json({ ok: true })),
      http.delete("/api/friends/block/:userId/", () =>
        HttpResponse.json({ ok: true }),
      ),
      http.get("/api/friends/blocked/", () =>
        HttpResponse.json({ items: [friendItem] }),
      ),
    );

    expect(await apiService.getFriends()).toHaveLength(1);
    expect((await apiService.sendFriendRequest("alice")).status).toBe(
      "pending",
    );
    expect(await apiService.getIncomingRequests()).toHaveLength(1);
    expect(await apiService.getOutgoingRequests()).toHaveLength(1);

    await apiService.acceptFriendRequest(10);
    await apiService.declineFriendRequest(10);
    await apiService.cancelOutgoingFriendRequest(10);
    await apiService.removeFriend(22);
    await apiService.blockUser("alice");
    await apiService.unblockUser(22);

    expect(await apiService.getBlockedUsers()).toHaveLength(1);
    expect(sentUsername).toBe("alice");
  });

  it("supports group core and moderation endpoints", async () => {
    let publicGroupsSearch = "";
    let publicGroupsBefore = "";
    let myGroupsSearch = "";
    let myGroupsLimit = "";
    let membersBefore = "";

    server.use(
      http.post("/api/groups/", () => HttpResponse.json(group)),
      http.get("/api/groups/public/", ({ request }) => {
        const search = new URL(request.url).searchParams;
        publicGroupsSearch = search.get("search") ?? "";
        publicGroupsBefore = search.get("before") ?? "";
        return HttpResponse.json(groupList);
      }),
      http.get("/api/groups/my/", ({ request }) => {
        const search = new URL(request.url).searchParams;
        myGroupsSearch = search.get("search") ?? "";
        myGroupsLimit = search.get("limit") ?? "";
        return HttpResponse.json(groupList);
      }),
      http.get("/api/groups/:slug/", () => HttpResponse.json(group)),
      http.patch("/api/groups/:slug/", () => HttpResponse.json(group)),
      http.delete("/api/groups/:slug/", () => HttpResponse.json({ ok: true })),
      http.post("/api/groups/:slug/join/", () =>
        HttpResponse.json({ ok: true }),
      ),
      http.post("/api/groups/:slug/leave/", () =>
        HttpResponse.json({ ok: true }),
      ),
      http.get("/api/groups/:slug/members/", ({ request }) => {
        membersBefore = new URL(request.url).searchParams.get("before") ?? "";
        return HttpResponse.json({
          items: [
            {
              userId: 1,
              username: "owner",
              nickname: null,
              roles: ["Owner"],
              profileImage: null,
              avatarCrop: null,
              joinedAt: now,
              isMuted: false,
              isSelf: true,
            },
          ],
          total: 1,
          pagination: { limit: 50, hasMore: false, nextBefore: null },
        });
      }),
      http.delete("/api/groups/:slug/members/:userId/", () =>
        HttpResponse.json({ ok: true }),
      ),
      http.post("/api/groups/:slug/members/:userId/ban/", () =>
        HttpResponse.json({ ok: true }),
      ),
      http.post("/api/groups/:slug/members/:userId/unban/", () =>
        HttpResponse.json({ ok: true }),
      ),
      http.post("/api/groups/:slug/members/:userId/mute/", () =>
        HttpResponse.json({ ok: true }),
      ),
      http.post("/api/groups/:slug/members/:userId/unmute/", () =>
        HttpResponse.json({ ok: true }),
      ),
      http.get("/api/groups/:slug/banned/", () =>
        HttpResponse.json({
          items: [
            {
              userId: 22,
              username: "alice",
              reason: "spam",
              bannedBy: "owner",
            },
          ],
          total: 1,
        }),
      ),
    );

    expect(
      (
        await apiService.createGroup({
          name: "Group One",
          description: "group description",
          isPublic: true,
          username: "group_one",
        })
      ).slug,
    ).toBe("101");
    expect(
      (
        await apiService.getPublicGroups({
          search: "Group",
          before: 321,
          limit: 5,
        })
      ).items,
    ).toHaveLength(1);
    expect(
      (await apiService.getMyGroups({ search: "one", limit: 7 }))
        .items,
    ).toHaveLength(1);
    expect((await apiService.getGroupDetails("101")).name).toBe(
      "Group One",
    );

    await apiService.updateGroup("101", {
      name: "Group One Updated",
      description: "updated",
    });

    await apiService.deleteGroup("101");
    await apiService.joinGroup("101");
    await apiService.leaveGroup("101");

    expect(
      (await apiService.getGroupMembers("101", { limit: 50, before: 99 }))
        .total,
    ).toBe(1);

    await apiService.kickMember("101", 22);
    await apiService.banMember("101", 22, "spam");
    await apiService.unbanMember("101", 22);
    await apiService.muteMember("101", 22, 1800);
    await apiService.unmuteMember("101", 22);

    expect((await apiService.getBannedMembers("101")).total).toBe(1);

    expect(publicGroupsSearch).toBe("Group");
    expect(publicGroupsBefore).toBe("321");
    expect(myGroupsSearch).toBe("one");
    expect(myGroupsLimit).toBe("7");
    expect(membersBefore).toBe("99");
  });

  it("supports invite, join-request and pin endpoints", async () => {
    let inviteExpiresInSeconds = 0;

    server.use(
      http.post("/api/groups/:slug/invites/", async ({ request }) => {
        const payload = (await request.json()) as { expiresInSeconds?: number };
        inviteExpiresInSeconds = payload.expiresInSeconds ?? 0;
        return HttpResponse.json(invite);
      }),
      http.get("/api/groups/:slug/invites/", () =>
        HttpResponse.json({ items: [invite] }),
      ),
      http.delete("/api/groups/:slug/invites/:code/", () =>
        HttpResponse.json({ ok: true }),
      ),
      http.get("/api/invite/:code/", () =>
        HttpResponse.json({
          code: "INV-123",
          groupId: group.roomId,
          groupName: group.name,
          groupDescription: group.description,
          memberCount: group.memberCount,
          isPublic: true,
        }),
      ),
      http.post("/api/invite/:code/join/", () =>
        HttpResponse.json({ roomId: group.roomId }),
      ),
      http.get("/api/groups/:slug/requests/", () =>
        HttpResponse.json({
          items: [
            {
              id: 50,
              userId: 22,
              username: "alice",
              message: "please",
              createdAt: now,
            },
          ],
        }),
      ),
      http.post("/api/groups/:slug/requests/:requestId/approve/", () =>
        HttpResponse.json({ ok: true }),
      ),
      http.post("/api/groups/:slug/requests/:requestId/reject/", () =>
        HttpResponse.json({ ok: true }),
      ),
      http.get("/api/groups/:slug/pins/", () =>
        HttpResponse.json({
          items: [
            {
              messageId: 99,
              content: "Pinned",
              author: "alice",
              pinnedBy: "owner",
              pinnedAt: now,
              createdAt: now,
            },
          ],
        }),
      ),
      http.post("/api/groups/:slug/pins/", () =>
        HttpResponse.json({ ok: true }),
      ),
      http.delete("/api/groups/:slug/pins/:messageId/", () =>
        HttpResponse.json({ ok: true }),
      ),
      http.post("/api/groups/:slug/transfer-ownership/", () =>
        HttpResponse.json({ ok: true }),
      ),
    );

    expect(
      (
        await apiService.createInvite("101", {
          maxUses: 10,
          expiresInHours: 2,
        })
      ).code,
    ).toBe("INV-123");
    expect(await apiService.getInvites("101")).toHaveLength(1);
    await apiService.revokeInvite("101", "INV-123");
    expect((await apiService.getInvitePreview("INV-123")).groupId).toBe(101);
    expect((await apiService.joinViaInvite("INV-123")).roomId).toBe(101);
    expect(await apiService.getJoinRequests("101")).toHaveLength(1);
    await apiService.approveJoinRequest("101", 50);
    await apiService.rejectJoinRequest("101", 50);
    expect(await apiService.getPinnedMessages("101")).toHaveLength(1);
    await apiService.pinMessage("101", 99);
    await apiService.unpinMessage("101", 99);
    await apiService.transferOwnership("101", 22);

    expect(inviteExpiresInSeconds).toBe(7200);
  });

  it("supports roles and permissions endpoints", async () => {
    server.use(
      http.get("/api/chat/rooms/:slug/roles/", () =>
        HttpResponse.json({ items: [roomRole] }),
      ),
      http.post("/api/chat/rooms/:slug/roles/", () =>
        HttpResponse.json({ item: roomRole }),
      ),
      http.patch("/api/chat/rooms/:slug/roles/:roleId/", () =>
        HttpResponse.json({ item: roomRole }),
      ),
      http.delete("/api/chat/rooms/:slug/roles/:roleId/", () =>
        HttpResponse.json({ ok: true }),
      ),
      http.get("/api/chat/rooms/:slug/members/:userId/roles/", () =>
        HttpResponse.json({ item: memberRoles }),
      ),
      http.patch("/api/chat/rooms/:slug/members/:userId/roles/", () =>
        HttpResponse.json({ item: memberRoles }),
      ),
      http.get("/api/chat/rooms/:slug/overrides/", () =>
        HttpResponse.json({ items: [override] }),
      ),
      http.post("/api/chat/rooms/:slug/overrides/", () =>
        HttpResponse.json({ item: override }),
      ),
      http.patch("/api/chat/rooms/:slug/overrides/:overrideId/", () =>
        HttpResponse.json({ item: override }),
      ),
      http.delete("/api/chat/rooms/:slug/overrides/:overrideId/", () =>
        HttpResponse.json({ ok: true }),
      ),
      http.get("/api/chat/rooms/:slug/permissions/me/", () =>
        HttpResponse.json({
          permissions: 15,
          roles: [4],
          isMember: true,
          isBanned: false,
          canJoin: false,
        }),
      ),
    );

    expect(await apiService.getRoomRoles("101")).toHaveLength(1);
    expect(
      (
        await apiService.createRoomRole("101", {
          name: "Moderator",
          color: "#ffcc00",
          permissions: 15,
        })
      ).id,
    ).toBe(4);
    expect(
      (
        await apiService.updateRoomRole("101", 4, {
          name: "Mod+",
          permissions: 31,
        })
      ).id,
    ).toBe(4);
    await apiService.deleteRoomRole("101", 4);

    expect((await apiService.getMemberRoles("101", 22)).roleIds).toEqual([
      4,
    ]);
    expect(
      (await apiService.setMemberRoles("101", 22, [4])).roleIds,
    ).toEqual([4]);

    expect(await apiService.getRoomOverrides("101")).toHaveLength(1);
    expect(
      (
        await apiService.createRoomOverride("101", {
          targetRoleId: 4,
          allow: 8,
          deny: 1,
        })
      ).id,
    ).toBe(6);
    expect(
      (
        await apiService.updateRoomOverride("101", 6, {
          allow: 16,
          deny: 0,
        })
      ).id,
    ).toBe(6);
    await apiService.deleteRoomOverride("101", 6);

    expect((await apiService.getMyPermissions("101")).permissions).toBe(
      15,
    );
  });

  it("supports global search and attachments endpoints", async () => {
    let searchQuery = "";
    let attachmentsBefore = "";

    server.use(
      http.get("/api/chat/search/global/", ({ request }) => {
        const search = new URL(request.url).searchParams;
        searchQuery = search.get("q") ?? "";
        return HttpResponse.json({
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
              roomId: 101,
              name: group.name,
              description: group.description,
              publicRef: group.username ? `@${group.username}` : "",
              memberCount: group.memberCount,
              isPublic: true,
            },
          ],
          messages: [
            {
              id: 44,
              username: "alice",
              content: "hello",
              createdAt: now,
              roomId: 101,
              roomName: group.name,
              roomKind: "group",
            },
          ],
        });
      }),
      http.get("/api/chat/rooms/:slug/attachments/", ({ request }) => {
        attachmentsBefore =
          new URL(request.url).searchParams.get("before") ?? "";
        return HttpResponse.json({
          items: [
            {
              id: 5,
              originalFilename: "notes.txt",
              contentType: "text/plain",
              fileSize: 12,
              url: "https://cdn.example.com/notes.txt",
              thumbnailUrl: null,
              width: null,
              height: null,
              messageId: 44,
              createdAt: now,
              username: "alice",
            },
          ],
          pagination: { limit: 20, hasMore: false, nextBefore: null },
        });
      }),
    );

    expect(
      (
        await apiService.globalSearch("group_one", {
          usersLimit: 5,
          groupsLimit: 3,
          messagesLimit: 2,
        })
      ).groups,
    ).toHaveLength(1);
    expect(
      (
        await apiService.getRoomAttachments("101", {
          limit: 20,
          before: 100,
        })
      ).items,
    ).toHaveLength(1);

    expect(searchQuery).toBe("group_one");
    expect(attachmentsBefore).toBe("100");
  });

  it("resolves public room ref to numeric roomId for attachment list/read endpoints", async () => {
    let listRoomRef = "";
    let readRoomRef = "";

    server.use(
      http.get("/api/chat/public-room/", () =>
        HttpResponse.json({
          roomId: 777,
          name: "Public",
          kind: "public",
        }),
      ),
      http.get("/api/chat/rooms/:slug/attachments/", ({ params }) => {
        listRoomRef = String(params.slug);
        return HttpResponse.json({
          items: [],
          pagination: { limit: 20, hasMore: false, nextBefore: null },
        });
      }),
      http.post("/api/chat/rooms/:slug/read/", ({ params }) => {
        readRoomRef = String(params.slug);
        return HttpResponse.json({ roomId: 777, lastReadMessageId: null });
      }),
    );

    await apiService.getRoomAttachments("public");
    await apiService.markRead("public");

    expect(listRoomRef).toBe("777");
    expect(readRoomRef).toBe("777");
  });

  it("normalizes role endpoint errors in extended matrix scenarios", async () => {
    server.use(
      http.get("/api/chat/rooms/:slug/roles/", () =>
        HttpResponse.json({ detail: "forbidden" }, { status: 403 }),
      ),
    );

    await expect(apiService.getRoomRoles("101")).rejects.toMatchObject({
      status: 403,
      message: expect.stringContaining("forbidden"),
      data: expect.objectContaining({ detail: "forbidden" }),
    });
  });

  it("keeps already-normalized ApiError objects intact", () => {
    const normalized = normalizeAxiosError({ status: 418, message: "teapot" });
    expect(normalized).toEqual({ status: 418, message: "teapot" });
  });

  it("returns fallback for unknown error shapes", () => {
    const normalized = normalizeAxiosError(new Error("unknown"));
    expect(normalized.status).toBe(0);
    expect(typeof normalized.message).toBe("string");
    expect(normalized.message.length).toBeGreaterThan(0);
  });
});

