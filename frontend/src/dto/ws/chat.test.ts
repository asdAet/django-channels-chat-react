import { describe, expect, it } from "vitest";

import { decodeChatWsEvent } from "./chat";

describe("chat WS DTO decoder", () => {
  it("decodes rate limited event", () => {
    const decoded = decodeChatWsEvent(
      JSON.stringify({ error: "rate_limited", retry_after: "3" }),
    );
    expect(decoded).toEqual({ type: "rate_limited", retryAfterSeconds: 3 });
  });

  it("decodes chat message event", () => {
    const decoded = decodeChatWsEvent(
      JSON.stringify({
        message: "hello",
        username: "alice",
        profile_pic: null,
        avatar_crop: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
      }),
    );

    expect(decoded.type).toBe("chat_message");
    if (decoded.type === "chat_message") {
      expect(decoded.message.username).toBe("alice");
      expect(decoded.message.avatarCrop).toEqual({
        x: 0.1,
        y: 0.2,
        width: 0.3,
        height: 0.4,
      });
    }
  });

  it("returns unknown for invalid payload", () => {
    const decoded = decodeChatWsEvent("{bad json");
    expect(decoded.type).toBe("unknown");
  });
});
