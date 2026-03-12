import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RegisterPage } from "./RegisterPage";

describe("RegisterPage", () => {
  it("submits registration payload with confirmation", () => {
    const onSubmit = vi.fn();
    render(
      <RegisterPage
        onSubmit={onSubmit}
        onNavigate={vi.fn()}
        passwordRules={["rule"]}
      />,
    );

    fireEvent.change(screen.getByTestId("auth-name-input"), {
      target: { value: "Alice" },
    });
    fireEvent.change(screen.getByTestId("auth-last-name-input"), {
      target: { value: "Smith" },
    });
    fireEvent.change(screen.getByTestId("auth-username-input"), {
      target: { value: "newuser" },
    });
    fireEvent.change(screen.getByTestId("auth-password-input"), {
      target: { value: "secret123" },
    });
    fireEvent.change(screen.getByTestId("auth-confirm-input"), {
      target: { value: "secret123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Создать аккаунт" }));

    expect(onSubmit).toHaveBeenCalledWith(
      "Alice",
      "Smith",
      "newuser",
      "secret123",
      "secret123",
    );
  });
});
