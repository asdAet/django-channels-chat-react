import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ContextMenu } from "./ContextMenu";

describe("ContextMenu", () => {
  it("clamps position to viewport bounds without state updates in effects", () => {
    const rectSpy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue({
        x: 0,
        y: 0,
        width: 300,
        height: 200,
        top: 0,
        right: 300,
        bottom: 200,
        left: 0,
        toJSON: () => ({}),
      } as DOMRect);

    render(
      <ContextMenu
        items={[{ label: "Action", onClick: vi.fn() }]}
        x={window.innerWidth}
        y={window.innerHeight}
        onClose={vi.fn()}
      />,
    );

    const menu = screen.getByRole("menu") as HTMLDivElement;
    expect(menu.style.left).toBe(`${window.innerWidth - 300 - 8}px`);
    expect(menu.style.top).toBe(`${window.innerHeight - 200 - 8}px`);

    rectSpy.mockRestore();
  });

  it("invokes action and closes on enabled item click", () => {
    const onClose = vi.fn();
    const onClick = vi.fn();

    render(
      <ContextMenu
        items={[{ label: "Action", onClick }]}
        x={100}
        y={120}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole("menuitem", { name: "Action" }));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not invoke action for disabled item", () => {
    const onClose = vi.fn();
    const onClick = vi.fn();

    render(
      <ContextMenu
        items={[{ label: "Disabled", onClick, disabled: true }]}
        x={100}
        y={120}
        onClose={onClose}
      />,
    );

    const disabledButton = screen.getByRole("menuitem", { name: "Disabled" });
    expect(disabledButton).toBeDisabled();

    fireEvent.click(disabledButton);

    expect(onClick).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();

    render(
      <ContextMenu
        items={[{ label: "Action", onClick: vi.fn() }]}
        x={100}
        y={120}
        onClose={onClose}
      />,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
