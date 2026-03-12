import { describe, expect, it } from "vitest";

import {
  decodeDirectChatsResponse,
  decodeDirectStartResponse,
  decodeRoomMessagesResponse,
} from "./chat";

describe("chat HTTP DTO decoders", () => {
  it("decodes room messages response", () => {
    const decoded = decodeRoomMessagesResponse({
      messages: [
        {
          id: 1,
          username: "alice",
          content: "hi",
          profilePic: null,
          avatarCrop: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
          createdAt: "2026-02-18T00:00:00Z",
        },
      ],
      pagination: { limit: 50, hasMore: false, nextBefore: null },
    });

    expect(decoded.messages).toHaveLength(1);
    expect(decoded.messages[0]?.avatarCrop).toEqual({
      x: 0.1,
      y: 0.2,
      width: 0.3,
      height: 0.4,
    });
    expect(decoded.pagination?.limit).toBe(50);
  });

  it("decodes direct start response", () => {
    const decoded = decodeDirectStartResponse({
      slug: "dm_123",
      kind: "direct",
      peer: {
        username: "bob",
        profileImage: null,
        avatarCrop: { x: 0.11, y: 0.22, width: 0.33, height: 0.44 },
        lastSeen: null,
      },
    });

    expect(decoded.peer.username).toBe("bob");
    expect(decoded.peer.avatarCrop).toEqual({
      x: 0.11,
      y: 0.22,
      width: 0.33,
      height: 0.44,
    });
  });

  it("decodes direct chats response", () => {
    const decoded = decodeDirectChatsResponse({
      items: [
        {
          slug: "dm_123",
          peer: { username: "bob", profileImage: null },
          lastMessage: "hello",
          lastMessageAt: "2026-02-18T00:00:00Z",
        },
      ],
    });

    expect(decoded.items[0]?.slug).toBe("dm_123");
  });
});
