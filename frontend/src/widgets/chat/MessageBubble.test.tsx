import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Message } from "../../entities/message/types";
import { MessageBubble } from "./MessageBubble";

const baseMessage: Message = {
  id: 1,
  username: "alice",
  content: "audio message",
  profilePic: null,
  avatarCrop: null,
  createdAt: "2026-03-11T10:00:00.000Z",
  editedAt: null,
  isDeleted: false,
  replyTo: null,
  attachments: [],
  reactions: [],
};

describe("MessageBubble", () => {
  it("renders AudioAttachmentPlayer for audio attachments", () => {
    const message: Message = {
      ...baseMessage,
      attachments: [
        {
          id: 10,
          originalFilename: "voice.mp3",
          contentType: "audio/mpeg",
          fileSize: 1024,
          url: "/media/voice.mp3",
          thumbnailUrl: null,
          width: null,
          height: null,
        },
      ],
    };

    render(
      <MessageBubble
        message={message}
        isOwn={false}
        onlineUsernames={new Set<string>()}
      />,
    );

    expect(screen.getByTestId("audio-attachment-player")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Воспроизвести" }),
    ).toBeInTheDocument();
    expect(screen.getByText("voice.mp3")).toBeInTheDocument();
  });
});
