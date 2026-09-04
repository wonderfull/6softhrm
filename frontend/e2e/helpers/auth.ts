import { expect, Page, request as playwrightRequest } from '@playwright/test'

const backendBaseUrl = 'http://localhost:4000'

// Signing in through the form on every test burns through the login rate
// limit (20 per 15 minutes) long before the suite finishes, and the failures
// look like broken pages rather than a throttled login. Each account is
// authenticated once and the session reused, which is also a great deal
// faster. `loginThroughForm` stays for the tests whose subject is the form.
const tokens = new Map<string, string>()

async function tokenFor(email: string, password: string) {
  const cached = tokens.get(email)
  if (cached) return cached

  const api = await playwrightRequest.newContext({ baseURL: backendBaseUrl })
  const response = await api.post('/api/auth/login', {
    data: { email, password },
  })
  expect(
    response.ok(),
    `Login failed for ${email}: ${response.status()} ${await response.text()}`,
  ).toBeTruthy()
  const { token } = await response.json()
  await api.dispose()

  tokens.set(email, token)
  return token as string
}

export async function loginAs(page: Page, email: string, password: string) {
  const token = await tokenFor(email, password)

  // The token has to be in place before the app's first render, otherwise it
  // bounces to /login and the redirect races the assertion.
  await page.goto('/login')
  await page.evaluate((value) => localStorage.setItem('token', value), token)
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/dashboard$/)
}

/** Drives the real login form. Use only where the form itself is the subject. */
export async function loginThroughForm(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByPlaceholder('you@example.com').fill(email)
  await page.getByPlaceholder('••••••••').fill(password)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
}

export async function logout(page: Page) {
  await page.evaluate(() => {
    localStorage.removeItem('token')
  })
  await page.goto('/login')
}
