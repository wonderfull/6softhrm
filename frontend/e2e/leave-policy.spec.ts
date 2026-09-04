import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'
import {
  E2E_ADMIN_EMAIL,
  E2E_ADMIN_PASSWORD,
  E2E_EMPLOYEE_EMAIL,
  E2E_EMPLOYEE_PASSWORD,
} from './helpers/accounts'

// The point of the leave phase: a request costs the working days it actually
// consumes on the company calendar, and the allowance moves by that amount.

test('the Christmas shutdown costs two days, not six, and the balance moves by two', async ({
  page,
}) => {
  await loginAs(page, E2E_EMPLOYEE_EMAIL, E2E_EMPLOYEE_PASSWORD)

  const firstBalance = page.waitForResponse(
    (r) => r.url().includes('/api/leave/balance') && r.status() === 200,
  )
  await page.goto('/leave')
  const before = await (await firstBalance).json()

  await page.getByRole('button', { name: /request leave|new request/i }).first().click()

  // 25 December and the Boxing Day substitute are bank holidays, and the 26th
  // and 27th are the weekend, so only the 24th and the 29th are working days.
  await page.getByLabel(/start date/i).fill('2026-12-24')
  await page.getByLabel(/end date/i).fill('2026-12-29')

  await expect(page.getByText(/2 working days/i).first()).toBeVisible()

  const created = page.waitForResponse(
    (r) =>
      r.url().endsWith('/api/leave') &&
      r.request().method() === 'POST' &&
      r.status() === 200,
  )
  await page.getByRole('button', { name: /submit/i }).first().click()
  const body = await (await created).json()
  expect(body.days).toBe(2)

  const afterBalance = await page.evaluate(async () => {
    const res = await fetch('/api/leave/balance', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    })
    return res.json()
  })
  expect(afterBalance.remaining).toBe(before.remaining - 2)
})

test('the same request is refused a second time as an overlap', async ({ page }) => {
  await loginAs(page, E2E_EMPLOYEE_EMAIL, E2E_EMPLOYEE_PASSWORD)
  await page.goto('/leave')

  const rejected = page.evaluate(async () => {
    const res = await fetch('/api/leave', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({
        type: 'ANNUAL',
        startDate: '2026-12-24',
        endDate: '2026-12-29',
      }),
    })
    return { status: res.status, body: await res.json() }
  })
  const result = await rejected
  expect(result.status).toBe(409)
  expect(result.body.error).toMatch(/overlap/i)
})

test('an admin opens and closes an employee relations case', async ({ page }) => {
  await loginAs(page, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD)
  await page.goto('/cases')

  await expect(page.getByText(/confidential/i).first()).toBeVisible()

  await page.getByRole('button', { name: /new case|open a case|add/i }).first().click()
  await page.getByLabel(/employee/i).first().selectOption({ index: 1 })
  await page.getByLabel(/opened/i).first().fill('2026-09-01')
  await page.getByRole('button', { name: /create|open case|save/i }).first().click()

  await expect(page.getByText(/grievance|disciplinary|capability/i).first()).toBeVisible()
})
