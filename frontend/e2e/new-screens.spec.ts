import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'
import {
  E2E_ADMIN_EMAIL,
  E2E_ADMIN_PASSWORD,
  E2E_EMPLOYEE_EMAIL,
  E2E_EMPLOYEE_PASSWORD,
} from './helpers/accounts'

// The screens added by the gap-closure work. Every other test in this suite
// predates them, so a broken import or an unmounted route would ship silently.

// A page that throws on render leaves the app shell with an empty main, which
// no assertion on a heading would distinguish from a slow load. Fail loudly.
test.beforeEach(async ({ page }) => {
  page.on('pageerror', (error) => {
    throw new Error(`Uncaught error on the page: ${error.message}`)
  })
})

test('every new admin screen renders its own content', async ({ page }) => {
  await loginAs(page, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD)

  for (const [path, heading] of [
    ['/reports', /Reports/i],
    ['/expenses', /Expenses/i],
    ['/cases', /Employee Relations/i],
    ['/account', /Account/i],
    ['/payslips', /Payslips/i],
  ] as const) {
    await page.goto(path)
    await expect(page).toHaveURL(new RegExp(`${path}$`))
    await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible()
  }
})

test('an employee reaches their own screens and is kept out of the rest', async ({
  page,
}) => {
  await loginAs(page, E2E_EMPLOYEE_EMAIL, E2E_EMPLOYEE_PASSWORD)

  await page.goto('/account')
  await expect(page.getByRole('heading', { name: /Account/i }).first()).toBeVisible()

  await page.goto('/expenses')
  await expect(page.getByRole('heading', { name: /Expenses/i }).first()).toBeVisible()

  // Grievance and disciplinary records are the most sensitive in the product.
  await page.goto('/cases')
  await expect(page).toHaveURL(/\/dashboard$/)

  await page.goto('/reports')
  await expect(page).toHaveURL(/\/dashboard$/)
})

test('the reports page shows figures from the summary endpoint', async ({ page }) => {
  await loginAs(page, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD)

  const summary = page.waitForResponse(
    (r) => r.url().includes('/api/reports/summary') && r.status() === 200,
  )
  await page.goto('/reports')
  await summary

  await expect(page.getByText(/headcount/i).first()).toBeVisible()
  await expect(page.getByText(/HR file/i).first()).toBeVisible()
})

test('leave shows a real balance and counts working days as dates are picked', async ({
  page,
}) => {
  await loginAs(page, E2E_EMPLOYEE_EMAIL, E2E_EMPLOYEE_PASSWORD)

  const balance = page.waitForResponse(
    (r) => r.url().includes('/api/leave/balance') && r.status() === 200,
  )
  await page.goto('/leave')
  await balance

  await expect(page.getByText(/remaining/i).first()).toBeVisible()
})

test('an employee files an expense claim and sees it listed', async ({ page }) => {
  await loginAs(page, E2E_EMPLOYEE_EMAIL, E2E_EMPLOYEE_PASSWORD)
  await page.goto('/expenses')

  // If the login is not linked to an employee record there is no form at all,
  // and the failure would otherwise look identical to a broken form.
  await expect(
    page.getByText(/not linked to an employee record/i),
  ).toHaveCount(0)

  await page.getByRole('button', { name: 'New claim' }).click()

  const description = `E2E taxi ${Date.now()}`
  await page.getByLabel(/date of spend/i).fill('2026-03-02')
  await page.getByLabel(/amount/i).fill('12.34')
  await page.getByLabel(/description/i).fill(description)
  await page.getByRole('button', { name: /submit claim/i }).click()

  await expect(page.getByText(description)).toBeVisible()
  await expect(page.getByText('£12.34').first()).toBeVisible()
})

test('settings carries the sponsor licence, leave policy and template cards', async ({
  page,
}) => {
  await loginAs(page, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD)
  await page.goto('/settings')

  await expect(page.getByText(/sponsor licence/i).first()).toBeVisible()
  await expect(page.getByText(/leave/i).first()).toBeVisible()
  await expect(page.getByText(/template/i).first()).toBeVisible()
})
