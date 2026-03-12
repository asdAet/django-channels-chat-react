import { describe, expect, it } from "vitest";

import {
  buildLoginRequestDto,
  decodeAuthErrorPayload,
  decodeProfileEnvelopeResponse,
  decodeSessionResponse,
} from "./auth";

describe("auth DTO decoders", () => {
  it("decodes session with user", () => {
    const decoded = decodeSessionResponse({
      authenticated: true,
      user: {
        username: "alice",
        email: "alice@example.com",
        profileImage: null,
        avatarCrop: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
        bio: "bio",
        lastSeen: null,
        registeredAt: null,
      },
    });

    expect(decoded.authenticated).toBe(true);
    expect(decoded.user?.username).toBe("alice");
    expect(decoded.user?.avatarCrop).toEqual({
      x: 0.1,
      y: 0.2,
      width: 0.3,
      height: 0.4,
    });
  });

  it("decodes profile envelope with defaults", () => {
    const decoded = decodeProfileEnvelopeResponse({
      user: {
        username: "bob",
      },
    });

    expect(decoded.user).toEqual({
      name: "",
      last_name: "",
      username: "bob",
      email: "",
      profileImage: null,
      avatarCrop: null,
      bio: "",
      lastSeen: null,
      registeredAt: null,
    });
  });

  it("validates outgoing login payload", () => {
    expect(
      buildLoginRequestDto({ username: "  demo ", password: "pass" }),
    ).toEqual({
      username: "demo",
      password: "pass",
    });
  });

  it("safely decodes auth error payload", () => {
    const decoded = decodeAuthErrorPayload({ errors: { username: ["taken"] } });
    expect(decoded?.errors?.username).toEqual(["taken"]);
  });
});
