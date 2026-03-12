import { expect, test, type Page } from "@playwright/test";

async function register(page: Page, username: string, password: string) {
  await page.goto("/register");
  await page.getByTestId("auth-name-input").fill("Test");
  await page.getByTestId("auth-last-name-input").fill("User");
  await page.getByTestId("auth-username-input").fill(username);
  await page.getByTestId("auth-password-input").fill(password);
  await page.getByTestId("auth-confirm-input").fill(password);

  const registerResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/auth/register/") &&
      response.request().method() === "POST",
  );
  await page.getByTestId("auth-submit-button").click();
  const registerResponse = await registerResponsePromise;
  if (!registerResponse.ok()) {
    const body = await registerResponse.text().catch(() => "");
    throw new Error(`register failed: ${registerResponse.status()} ${body}`);
  }

  await expect(page).toHaveURL("/", { timeout: 10_000 });
}

test("direct chat by username opens and delivers messages between users", async ({
  page,
  browser,
}) => {
  const uniq = Math.random().toString(36).slice(2, 6);
  const alice = `a${uniq}`;
  const bob = `b${uniq}`;
  const password = "pass12345";
  const text = `dm-${Date.now()}`;

  await register(page, alice, password);

  const bobContext = await browser.newContext();
  const bobPage = await bobContext.newPage();
  await register(bobPage, bob, password);

  await bobPage.goto(`/@${encodeURIComponent(alice)}`);
  await expect(bobPage).toHaveURL(`/@${encodeURIComponent(alice)}`);

  const input = bobPage.getByTestId("chat-message-input");
  await expect(input).toBeVisible({ timeout: 30_000 });
  await input.fill(text);
  await bobPage.getByTestId("chat-send-button").click();
  await expect(
    bobPage.getByRole("article").filter({ hasText: text }).first(),
  ).toBeVisible({ timeout: 15_000 });

  await page.goto(`/@${encodeURIComponent(bob)}`);
  await expect(page.getByTestId("chat-message-input")).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    page.getByRole("article").filter({ hasText: text }).first(),
  ).toBeVisible({ timeout: 15_000 });

  await bobPage.goto("/direct");
  await expect(bobPage.getByText(alice)).toBeVisible();

  await bobContext.close();
});
