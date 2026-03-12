import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AudioAttachmentPlayer } from "./AudioAttachmentPlayer";

describe("AudioAttachmentPlayer", () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() =>
      Promise.resolve(),
    );
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders metadata and allows play/pause toggle", async () => {
    const { container } = render(
      <AudioAttachmentPlayer
        src="/audio/test.mp3"
        title="test.mp3"
        subtitle="128 KB"
        downloadName="test.mp3"
      />,
    );

    expect(screen.getByText("test.mp3")).toBeInTheDocument();
    expect(screen.getByText("128 KB")).toBeInTheDocument();

    const audio = container.querySelector("audio") as HTMLAudioElement;
    Object.defineProperty(audio, "duration", { value: 65, configurable: true });
    Object.defineProperty(audio, "currentTime", {
      value: 0,
      writable: true,
      configurable: true,
    });
    fireEvent.loadedMetadata(audio);

    expect(screen.getByText("00:00 / 01:05")).toBeInTheDocument();

    const playButton = screen.getByRole("button", { name: "Воспроизвести" });
    fireEvent.click(playButton);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);

    fireEvent.play(audio);
    expect(screen.getByRole("button", { name: "Пауза" })).toBeInTheDocument();

    fireEvent.pause(audio);
    expect(
      screen.getByRole("button", { name: "Воспроизвести" }),
    ).toBeInTheDocument();
  });

  it("updates seek position and shows decode fallback message on error", () => {
    const { container } = render(
      <AudioAttachmentPlayer
        src="/audio/broken.mp3"
        title="broken.mp3"
        subtitle="64 KB"
      />,
    );

    const audio = container.querySelector("audio") as HTMLAudioElement;
    Object.defineProperty(audio, "duration", {
      value: 120,
      configurable: true,
    });
    Object.defineProperty(audio, "currentTime", {
      value: 0,
      writable: true,
      configurable: true,
    });
    fireEvent.loadedMetadata(audio);

    const slider = screen.getByLabelText("Позиция воспроизведения");
    fireEvent.change(slider, { target: { value: "30" } });
    expect(audio.currentTime).toBe(30);

    fireEvent.error(audio);
    expect(
      screen.getByText(
        "Не удалось воспроизвести аудио в браузере. Используйте кнопку «Скачать».",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Воспроизвести" }),
    ).toBeDisabled();
  });
});
