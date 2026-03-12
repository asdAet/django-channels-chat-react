import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const presenceMock = vi.hoisted(() => ({
  online: [] as Array<{ username: string; profileImage: string | null }>,
  guests: 0,
  status: "online" as const,
  lastError: null as string | null,
}));

const createObjectUrlMock = vi.hoisted(() => vi.fn(() => "blob:avatar-upload"));
const revokeObjectUrlMock = vi.hoisted(() => vi.fn());

vi.mock("../shared/presence", () => ({
  usePresence: () => presenceMock,
}));

vi.mock("../shared/ui", async () => {
  const actual =
    await vi.importActual<typeof import("../shared/ui")>("../shared/ui");
  return {
    ...actual,
    AvatarCropModal: ({
      open,
      onApply,
      onCancel,
    }: {
      open: boolean;
      onApply: (crop: {
        x: number;
        y: number;
        width: number;
        height: number;
      }) => void;
      onCancel: () => void;
    }) =>
      open ? (
        <div data-testid="avatar-crop-modal">
          <button
            type="button"
            onClick={() => onApply({ x: 0.1, y: 0.2, width: 0.3, height: 0.4 })}
          >
            Apply crop
          </button>
          <button type="button" onClick={onCancel}>
            Cancel crop
          </button>
        </div>
      ) : null,
  };
});

import { ProfilePage } from "./ProfilePage";

const user = {
  name: "",
  last_name: "",
  username: "demo",
  email: "demo@example.com",
  profileImage: null,
  avatarCrop: null,
  bio: "",
  lastSeen: null,
  registeredAt: "2026-01-01T10:00:00.000Z",
};

describe("ProfilePage", () => {
  beforeEach(() => {
    presenceMock.online = [];
    presenceMock.status = "online";
    presenceMock.lastError = null;
    createObjectUrlMock.mockClear();
    revokeObjectUrlMock.mockClear();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: createObjectUrlMock,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: revokeObjectUrlMock,
    });
  });

  it("asks guest to login before editing profile", () => {
    const onNavigate = vi.fn();

    render(
      <ProfilePage
        user={null}
        onSave={vi.fn(async () => ({ ok: true }))}
        onNavigate={onNavigate}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Войти" }));
    expect(onNavigate).toHaveBeenCalledWith("/login");
  });

  it("shows field-level validation errors from onSave", async () => {
    const onSave = vi.fn(async () => ({
      ok: false as const,
      errors: { username: ["Имя уже занято"] },
      message: "Проверьте введенные данные и попробуйте снова.",
    }));

    render(<ProfilePage user={user} onSave={onSave} onNavigate={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => {
      expect(screen.getByText("Имя уже занято")).toBeInTheDocument();
      expect(
        screen.getByText("Проверьте введенные данные и попробуйте снова."),
      ).toBeInTheDocument();
    });
  });

  it("shows max-bio warning over 1000 chars", () => {
    render(
      <ProfilePage
        user={user}
        onSave={vi.fn(async () => ({ ok: true }))}
        onNavigate={vi.fn()}
      />,
    );

    const textarea = screen.getByLabelText("Биография (необязательно)");
    fireEvent.change(textarea, { target: { value: "a".repeat(1001) } });

    expect(screen.getByText("Максимум 1000 символов.")).toBeInTheDocument();
  });

  it("shows online label when current user is online", () => {
    presenceMock.online = [{ username: "demo", profileImage: null }];

    const { container } = render(
      <ProfilePage
        user={user}
        onSave={vi.fn(async () => ({ ok: true }))}
        onNavigate={vi.fn()}
      />,
    );

    expect(screen.getByText("В сети")).toBeInTheDocument();
    expect(container.querySelector('[data-online="true"]')).not.toBeNull();
  });

  it("shows last seen label when current user is offline", () => {
    const { container } = render(
      <ProfilePage
        user={{ ...user, lastSeen: "2026-02-13T10:00:00.000Z" }}
        onSave={vi.fn(async () => ({ ok: true }))}
        onNavigate={vi.fn()}
      />,
    );

    expect(screen.getByText(/Последний раз в сети:/i)).toBeInTheDocument();
    expect(container.querySelector('[data-online="true"]')).toBeNull();
  });

  it("opens crop modal and submits selected crop with the original file", async () => {
    const onSave = vi.fn(async () => ({ ok: true as const }));
    const { container } = render(
      <ProfilePage user={user} onSave={onSave} onNavigate={vi.fn()} />,
    );

    const fileInput = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();

    const file = new File(["avatar"], "avatar.png", { type: "image/png" });
    fireEvent.change(fileInput as HTMLInputElement, {
      target: { files: [file] },
    });

    expect(screen.getByTestId("avatar-crop-modal")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Apply crop" }));
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        image: file,
        avatarCrop: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
      }),
    );
  });

  it("submits name separately from username", async () => {
    const onSave = vi.fn(async () => ({ ok: true as const }));
    render(<ProfilePage user={user} onSave={onSave} onNavigate={vi.fn()} />);

    fireEvent.change(screen.getByTestId("profile-name-input"), {
      target: { value: "Directness" },
    });
    fireEvent.change(screen.getByTestId("profile-username-input"), {
      target: { value: "demohandle" },
    });
    fireEvent.click(screen.getByTestId("profile-save-button"));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Directness",
        username: "demohandle",
      }),
    );
  });

  it("discards the pending upload when crop modal is cancelled", async () => {
    const onSave = vi.fn(async () => ({ ok: true as const }));
    const { container } = render(
      <ProfilePage user={user} onSave={onSave} onNavigate={vi.fn()} />,
    );

    const fileInput = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();

    const file = new File(["avatar"], "avatar.png", { type: "image/png" });
    fireEvent.change(fileInput as HTMLInputElement, {
      target: { files: [file] },
    });

    expect(screen.getByTestId("avatar-crop-modal")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel crop" }));
    expect(screen.queryByTestId("avatar-crop-modal")).toBeNull();

    fireEvent.click(screen.getByTestId("profile-save-button"));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        image: null,
        avatarCrop: null,
      }),
    );
  });
});
