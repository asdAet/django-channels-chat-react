import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Avatar } from "./Avatar";

describe("Avatar", () => {
  it("renders cropped image positioning when avatarCrop is provided", () => {
    const { container } = render(
      <Avatar
        username="alice"
        profileImage="https://cdn.example.com/alice.jpg"
        avatarCrop={{ x: 0.1, y: 0.2, width: 0.3, height: 0.4 }}
      />,
    );

    const image = container.querySelector("img");
    expect(image).not.toBeNull();
    expect(parseFloat(image?.style.width || "0")).toBeCloseTo(333.3333, 3);
    expect(parseFloat(image?.style.height || "0")).toBeCloseTo(250, 3);
    expect(parseFloat(image?.style.left || "0")).toBeCloseTo(-33.3333, 3);
    expect(parseFloat(image?.style.top || "0")).toBeCloseTo(-50, 3);
  });

  it("falls back to regular image rendering without avatarCrop", () => {
    const { container } = render(
      <Avatar
        username="alice"
        profileImage="https://cdn.example.com/alice.jpg"
      />,
    );

    const image = container.querySelector("img");
    expect(image?.style.width).toBe("");
    expect(image?.style.left).toBe("");
  });

  it("renders stable finite styles for edge-aligned crop values", () => {
    const { container } = render(
      <Avatar
        username="alice"
        profileImage="https://cdn.example.com/alice.jpg"
        avatarCrop={{ x: 0.88, y: 0.92, width: 0.12, height: 0.08 }}
      />,
    );

    const image = container.querySelector("img");
    expect(image).not.toBeNull();
    expect(parseFloat(image?.style.width || "0")).toBeCloseTo(833.3333, 3);
    expect(parseFloat(image?.style.height || "0")).toBeCloseTo(1250, 3);
    expect(parseFloat(image?.style.left || "0")).toBeCloseTo(-733.3333, 3);
    expect(parseFloat(image?.style.top || "0")).toBeCloseTo(-1150, 3);
    expect(image?.style.objectFit).toBe("fill");
    expect(image?.style.borderRadius).toBe("0");
  });

  it("falls back to initials when image fails to load", () => {
    render(
      <Avatar
        username="alice"
        profileImage="https://cdn.example.com/alice.jpg"
      />,
    );

    const image = screen.getByRole("img", { name: "alice" });
    fireEvent.error(image);

    expect(screen.queryByRole("img", { name: "alice" })).toBeNull();
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("resets failed-image state when profileImage changes", () => {
    const { rerender } = render(
      <Avatar username="alice" profileImage="https://cdn.example.com/a.jpg" />,
    );

    fireEvent.error(screen.getByRole("img", { name: "alice" }));
    expect(screen.queryByRole("img", { name: "alice" })).toBeNull();

    rerender(
      <Avatar username="alice" profileImage="https://cdn.example.com/b.jpg" />,
    );
    expect(screen.getByRole("img", { name: "alice" })).toBeInTheDocument();
  });
});
