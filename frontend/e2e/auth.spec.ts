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

test('register and login flow keeps session', async ({ page }) => {
  const username = `u${Date.now()}`
  const password = 'pass12345'

  await register(page, username, password)

  await page.goto('/profile')
  await expect(page.locator('input[type="text"]').first()).toHaveValue(username)

  await page.getByRole('button', { name: 'Выйти' }).click()
  await expect(page).toHaveURL('/login')

  await page.getByLabel('Имя пользователя').fill(username)
  await page.locator('input[type="password"]').fill(password)
  await page.locator('main').getByRole('button', { name: 'Войти' }).click()

  await expect(page).toHaveURL('/')
})
