import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Message } from "../../entities/message/types";
import {
  collectVisibleMessageIdsByBottomEdge,
  computeNextLastReadMessageId,
  computeUnreadStats,
  useReadTracker,
} from "./readTracker";

const makeMessage = (id: number, username: string): Message => ({
  id,
  username,
  content: `message-${id}`,
  profilePic: null,
  createdAt: new Date(2026, 2, 11, 12, id, 0).toISOString(),
  editedAt: null,
  isDeleted: false,
  replyTo: null,
  attachments: [],
  reactions: [],
});

describe("readTracker", () => {
  it("advances last read only for visible messages by bottom-edge rule", () => {
    const messages = [
      makeMessage(1, "alice"),
      makeMessage(2, "alice"),
      makeMessage(3, "alice"),
    ];
    const visible = new Set([1, 2]);

    const next = computeNextLastReadMessageId({
      messages,
      currentUsername: "demo",
      previousLastReadMessageId: 0,
      visibleMessageIds: visible,
    });

    expect(next).toBe(2);
  });

  it("does not mark partially hidden message as read when bottom edge is outside viewport", () => {
    const messages = [makeMessage(1, "alice"), makeMessage(2, "alice")];

    const next = computeNextLastReadMessageId({
      messages,
      currentUsername: "demo",
      previousLastReadMessageId: 0,
      visibleMessageIds: new Set([1]),
    });

    expect(next).toBe(1);
  });

  it("keeps local last read monotonic", () => {
    const messages = [
      makeMessage(1, "alice"),
      makeMessage(2, "alice"),
      makeMessage(3, "alice"),
    ];

    const next = computeNextLastReadMessageId({
      messages,
      currentUsername: "demo",
      previousLastReadMessageId: 3,
      visibleMessageIds: new Set([1, 2]),
    });

    expect(next).toBe(3);
  });

  it("ignores own messages in unread and read progress", () => {
    const messages = [
      makeMessage(1, "demo"),
      makeMessage(2, "alice"),
      makeMessage(3, "demo"),
    ];

    const next = computeNextLastReadMessageId({
      messages,
      currentUsername: "demo",
      previousLastReadMessageId: 0,
      visibleMessageIds: new Set([1, 2, 3]),
    });
    expect(next).toBe(2);

    const stats = computeUnreadStats({
      messages,
      currentUsername: "demo",
      lastReadMessageId: 1,
    });
    expect(stats.firstUnreadMessageId).toBe(2);
    expect(stats.unreadCount).toBe(1);
  });

  it("collects read candidates using message bottom <= viewport bottom", () => {
    const list = document.createElement("div");
    const first = document.createElement("article");
    first.dataset.messageId = "11";
    const second = document.createElement("article");
    second.dataset.messageId = "12";
    list.append(first, second);

    Object.defineProperty(list, "getBoundingClientRect", {
      value: () => ({ bottom: 500 }),
    });
    Object.defineProperty(first, "getBoundingClientRect", {
      value: () => ({ bottom: 420 }),
    });
    Object.defineProperty(second, "getBoundingClientRect", {
      value: () => ({ bottom: 520 }),
    });

    const visible = collectVisibleMessageIdsByBottomEdge(list);
    expect(visible.has(11)).toBe(true);
    expect(visible.has(12)).toBe(false);
  });

  it("does not move read progress while tracker is disabled", () => {
    const messages = [makeMessage(1, "alice"), makeMessage(2, "alice")];
    const list = document.createElement("div");
    const first = document.createElement("article");
    first.dataset.messageId = "1";
    const second = document.createElement("article");
    second.dataset.messageId = "2";
    list.append(first, second);

    Object.defineProperty(list, "getBoundingClientRect", {
      value: () => ({ bottom: 500 }),
    });
    Object.defineProperty(first, "getBoundingClientRect", {
      value: () => ({ bottom: 100 }),
    });
    Object.defineProperty(second, "getBoundingClientRect", {
      value: () => ({ bottom: 180 }),
    });

    const { result } = renderHook(() =>
      useReadTracker({
        messages,
        currentUsername: "demo",
        serverLastReadMessageId: 0,
        enabled: false,
        resetKey: "room-1",
      }),
    );

    act(() => {
      const next = result.current.applyViewportRead(list);
      expect(next).toBe(0);
    });

    expect(result.current.localLastReadMessageId).toBe(0);
    expect(result.current.firstUnreadMessageId).toBe(1);
    expect(result.current.localUnreadCount).toBe(2);
  });

  it("does not move read progress when viewport has no message nodes", () => {
    const messages = [makeMessage(1, "alice"), makeMessage(2, "alice")];
    const list = document.createElement("div");

    Object.defineProperty(list, "getBoundingClientRect", {
      value: () => ({ bottom: 500 }),
    });

    const { result } = renderHook(() =>
      useReadTracker({
        messages,
        currentUsername: "demo",
        serverLastReadMessageId: 0,
        enabled: true,
        resetKey: "room-empty",
      }),
    );

    act(() => {
      const next = result.current.applyViewportRead(list);
      expect(next).toBe(0);
    });

    expect(result.current.localLastReadMessageId).toBe(0);
    expect(result.current.firstUnreadMessageId).toBe(1);
    expect(result.current.localUnreadCount).toBe(2);
  });
});
