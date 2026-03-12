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

test("profile update works with validation and save", async ({ page }) => {
  const username = `p${Math.random().toString(36).slice(2, 9)}`;
  const password = "pass12345";
  const nextBio = "Updated profile bio text";

  await register(page, username, password);

  await page.goto("/profile");
  const bioField = page.getByTestId("profile-bio-input");
  await expect(bioField).toBeVisible();
  await bioField.fill(nextBio);
  await page.getByTestId("profile-save-button").click();

  await expect(page).toHaveURL(`/users/${encodeURIComponent(username)}`);
  await expect(page.getByText(nextBio)).toBeVisible();
});
