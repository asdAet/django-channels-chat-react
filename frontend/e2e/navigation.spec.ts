import { expect, test } from "@playwright/test";

test("basic navigation between home and public chat", async ({ page }) => {
  await page.goto("/");
  const isNarrowViewport = await page.evaluate(() => window.innerWidth <= 768);
  if (isNarrowViewport) {
    await expect(page.getByLabel("Поиск")).toBeVisible();
  } else {
    await expect(page.getByRole("heading", { name: "Devil" })).toBeVisible();
  }

  await page.goto("/rooms/public");
  await expect(page).toHaveURL("/rooms/public");

  await page.goto("/");
  await expect(page).toHaveURL("/");
});
