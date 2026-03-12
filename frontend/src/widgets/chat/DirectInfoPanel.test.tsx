import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const chatControllerMock = vi.hoisted(() => ({
  getRoomDetails: vi.fn(),
  getRoomAttachments: vi.fn(),
}));

vi.mock("../../controllers/ChatController", () => ({
  chatController: chatControllerMock,
}));

import { DirectInfoPanel } from "./DirectInfoPanel";

describe("DirectInfoPanel", () => {
  it("renders AudioAttachmentPlayer in attachments tab for audio items", async () => {
    chatControllerMock.getRoomDetails.mockResolvedValue({
      slug: "dm_1",
      name: "dm_1",
      kind: "direct",
      peer: {
        username: "alice",
        profileImage: null,
        lastSeen: null,
      },
    });
    chatControllerMock.getRoomAttachments.mockResolvedValue({
      items: [
        {
          id: 501,
          messageId: 10,
          originalFilename: "voice-note.mp3",
          contentType: "audio/mpeg",
          fileSize: 2048,
          url: "/media/voice-note.mp3",
          thumbnailUrl: null,
          width: null,
          height: null,
          createdAt: "2026-03-11T10:00:00.000Z",
          username: "alice",
        },
      ],
      pagination: { limit: 60, hasMore: false, nextBefore: null },
    });

    render(<DirectInfoPanel slug="dm_1" />);

    await waitFor(() => {
      expect(chatControllerMock.getRoomDetails).toHaveBeenCalledWith("dm_1");
      expect(chatControllerMock.getRoomAttachments).toHaveBeenCalledWith(
        "dm_1",
        { limit: 60 },
      );
    });

    const tabButtons = screen.getAllByRole("button");
    fireEvent.click(tabButtons[1]);

    expect(
      await screen.findByTestId("audio-attachment-player"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Воспроизвести" }),
    ).toBeInTheDocument();
    expect(screen.getByText("voice-note.mp3")).toBeInTheDocument();
  });
});
