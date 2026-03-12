import { describe, expect, it } from "vitest";

import {
  decodeFriendsListResponse,
  decodeIncomingRequestsResponse,
  decodeOutgoingRequestsResponse,
} from "./friends";

describe("friends DTO decoders", () => {
  it("maps profileImage and avatarCrop for friends list", () => {
    const decoded = decodeFriendsListResponse({
      items: [
        {
          id: 10,
          user: {
            id: 2,
            username: "bob",
            profileImage: "https://example.com/bob.jpg",
            avatarCrop: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
          },
          created_at: "2026-03-10T10:00:00.000Z",
        },
      ],
    });

    expect(decoded[0]?.profileImage).toBe("https://example.com/bob.jpg");
    expect(decoded[0]?.avatarCrop).toEqual({
      x: 0.1,
      y: 0.2,
      width: 0.3,
      height: 0.4,
    });
  });

  it("maps avatar fields for incoming/outgoing requests", () => {
    const payload = {
      items: [
        {
          id: 11,
          user: {
            id: 3,
            username: "charlie",
            profileImage: "https://example.com/charlie.jpg",
            avatarCrop: { x: 0.2, y: 0.2, width: 0.5, height: 0.5 },
          },
          created_at: "2026-03-10T10:00:00.000Z",
        },
      ],
    };

    const incoming = decodeIncomingRequestsResponse(payload);
    const outgoing = decodeOutgoingRequestsResponse(payload);

    expect(incoming[0]?.profileImage).toBe("https://example.com/charlie.jpg");
    expect(outgoing[0]?.avatarCrop).toEqual({
      x: 0.2,
      y: 0.2,
      width: 0.5,
      height: 0.5,
    });
  });
});
