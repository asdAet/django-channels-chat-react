import { expect, test } from '@playwright/test'

async function register(page: import('@playwright/test').Page, username: string, password: string) {
  await page.goto('/register')
  await page.getByLabel('Имя пользователя').fill(username)
  const passwordInputs = page.locator('input[type="password"]')
  await passwordInputs.nth(0).fill(password)
  await passwordInputs.nth(1).fill(password)

  await Promise.all([
    page.waitForResponse(
      (response) => response.url().includes('/api/auth/register/') && response.request().method() === 'POST',
    ),
    page.getByRole('button', { name: 'Создать аккаунт' }).click(),
  ])

  await expect(page).toHaveURL('/')
}

test('public chat allows authenticated send and keeps guest read-only mode', async ({ page, browser }) => {
  const username = `chat${Date.now()}`
  const password = 'pass12345'
  const text = `hello-${Date.now()}`

  await register(page, username, password)

  await page.goto('/rooms/public')
  const input = page.locator('.chat-input input').first()
  await expect(input).toBeVisible({ timeout: 15_000 })
  await input.fill(text)
  await page.locator('.chat-input button').first().click()
  await expect(page.getByText(text)).toBeVisible()

  const guestContext = await browser.newContext()
  const guestPage = await guestContext.newPage()
  await guestPage.goto('/rooms/public')
  await expect(guestPage.locator('.auth-callout')).toBeVisible()
  await expect(guestPage.locator('.chat-input input')).toHaveCount(0)
  await guestContext.close()
})
