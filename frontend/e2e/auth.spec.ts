import { expect, test, type Page } from "@playwright/test";

async function register(page: Page, username: string, password: string) {
  await page.goto("/register");
  await page.getByTestId("auth-name-input").fill("Test");
  await page.getByTestId("auth-last-name-input").fill("User");
  await page.getByTestId("auth-username-input").fill(username);
  await page.getByTestId("auth-password-input").fill(password);
  await page.getByTestId("auth-confirm-input").fill(password);

  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/api/auth/register/") &&
        response.request().method() === "POST",
    ),
    page.getByTestId("auth-submit-button").click(),
  ]);

  await expect(page).toHaveURL("/", { timeout: 10_000 });
}

test("register and login flow keeps session", async ({ page }) => {
  const username = `u${Math.random().toString(36).slice(2, 9)}`;
  const password = "pass12345";

  await register(page, username, password);

  await page.goto("/profile");
  await expect(page.getByTestId("profile-username-input")).toHaveValue(
    username,
  );

  await page.goto(`/users/${encodeURIComponent(username)}`);
  await page.getByTestId("logout-button").click();
  await expect(page).toHaveURL("/login");

  await page.getByTestId("auth-username-input").fill(username);
  await page.getByTestId("auth-password-input").fill(password);

  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/api/auth/login/") &&
        response.request().method() === "POST",
    ),
    page.getByTestId("auth-submit-button").click(),
  ]);

  await expect(page).toHaveURL("/");
});
