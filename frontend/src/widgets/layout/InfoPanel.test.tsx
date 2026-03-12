import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import {
  InfoPanelProvider,
  useInfoPanel,
} from "../../shared/layout/useInfoPanel";
import { InfoPanel } from "./InfoPanel";

vi.mock("../chat/ChatSearch", () => ({
  ChatSearch: ({ slug }: { slug: string }) => <div>search:{slug}</div>,
}));

vi.mock("../chat/DirectInfoPanel", () => ({
  DirectInfoPanel: ({ slug }: { slug: string }) => <div>direct:{slug}</div>,
}));

vi.mock("../chat/UserProfilePanel", () => ({
  UserProfilePanel: ({ username }: { username: string }) => (
    <div>profile:{username}</div>
  ),
}));

vi.mock("../groups/GroupInfoPanel", () => ({
  GroupInfoPanel: ({ slug }: { slug: string }) => <div>group:{slug}</div>,
}));

function Harness() {
  const { open, close } = useInfoPanel();

  return (
    <>
      <button type="button" onClick={() => open("group", "room-one")}>
        open-group
      </button>
      <button type="button" onClick={() => open("profile", "alice")}>
        open-profile
      </button>
      <button type="button" onClick={close}>
        close-panel
      </button>
      <InfoPanel currentUsername="me" />
    </>
  );
}

describe("InfoPanel", () => {
  it("keeps previous payload during close transition and unmounts after transition end", () => {
    const { container } = render(
      <MemoryRouter>
        <InfoPanelProvider>
          <Harness />
        </InfoPanelProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "open-group" }));
    expect(screen.getByText("group:room-one")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "close-panel" }));
    const asideBeforeEnd = container.querySelector("aside");
    expect(asideBeforeEnd).not.toBeNull();

    fireEvent.transitionEnd(asideBeforeEnd as HTMLElement);
    expect(container.querySelector("aside")).toBeNull();
  });

  it("updates displayed panel payload when switching content while open", () => {
    render(
      <MemoryRouter>
        <InfoPanelProvider>
          <Harness />
        </InfoPanelProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "open-group" }));
    expect(screen.getByText("group:room-one")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "open-profile" }));
    expect(screen.getByText("profile:alice")).toBeInTheDocument();
  });
});
