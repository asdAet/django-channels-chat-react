import { describe, expect, it } from "vitest";

import { decodeGroupListResponse, decodeGroupMembersResponse } from "./groups";

describe("groups DTO decoders", () => {
  it("accepts nullable nickname in members payload", () => {
    const decoded = decodeGroupMembersResponse({
      items: [
        {
          userId: 1,
          username: "alice",
          nickname: null,
          roles: [],
          joinedAt: "2026-03-10T10:00:00.000Z",
        },
      ],
      total: 1,
    });

    expect(decoded.items[0]?.nickname).toBe("");
  });

  it("maps group list avatar fields", () => {
    const decoded = decodeGroupListResponse({
      items: [
        {
          roomId: 101,
          name: "Group",
          description: "desc",
          username: "group",
          memberCount: 2,
          avatarUrl: "https://example.com/a.jpg",
          avatarCrop: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
        },
      ],
      total: 1,
      pagination: { limit: 20, hasMore: false, nextBefore: null },
    });

    expect(decoded.items[0]?.avatarUrl).toBe("https://example.com/a.jpg");
    expect(decoded.items[0]?.avatarCrop).toEqual({
      x: 0.1,
      y: 0.2,
      width: 0.3,
      height: 0.4,
    });
  });
});
