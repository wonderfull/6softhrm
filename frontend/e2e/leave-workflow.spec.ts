import { test, expect } from '@playwright/test'
import { loginAs, logout } from './helpers/auth'
import { E2E_EMPLOYEE_EMAIL, E2E_EMPLOYEE_PASSWORD, E2E_MANAGER_EMAIL, E2E_MANAGER_PASSWORD } from './helpers/accounts'


// Overlapping leave is refused, so every run books days no earlier run used.
// A Monday well into the future, offset by the run, keeps it a clean 3 working
// days without colliding with the fixtures or with itself.
function uniqueWorkingWeek() {
  const monday = new Date(Date.UTC(2030, 0, 7))
  monday.setUTCDate(monday.getUTCDate() + (Date.now() % 500) * 7)
  const wednesday = new Date(monday)
  wednesday.setUTCDate(wednesday.getUTCDate() + 2)
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  return { start: iso(monday), end: iso(wednesday) }
}

test('employee can submit leave and manager can approve it', async ({ browser }) => {
  const reason = `BDD leave workflow request ${Date.now()}`
  const week = uniqueWorkingWeek()
  const employeeContext = await browser.newContext()
  const employeePage = await employeeContext.newPage()

  await loginAs(employeePage, E2E_EMPLOYEE_EMAIL, E2E_EMPLOYEE_PASSWORD)
  await employeePage.goto('/leave')

  await employeePage.getByRole('button', { name: /Request Leave/i }).click()
  await employeePage.getByLabel('Leave Type *').selectOption('ANNUAL')
  await employeePage.getByLabel('Start Date *').fill(week.start)
  await employeePage.getByLabel('End Date *').fill(week.end)
  await employeePage.getByLabel('Reason').fill(reason)
  await employeePage.getByRole('button', { name: 'Submit Leave Request' }).click()
  const employeeRequestCard = employeePage.locator('[class*="p-4"]').filter({ hasText: reason }).first()
  await expect(employeeRequestCard).toBeVisible()

  await logout(employeePage)
  await employeeContext.close()

  const managerContext = await browser.newContext()
  const managerPage = await managerContext.newPage()

  await loginAs(managerPage, E2E_MANAGER_EMAIL, E2E_MANAGER_PASSWORD)
  await managerPage.goto('/leave')
  await expect(managerPage.getByText('Review and approve employee leave requests.')).toBeVisible()

  const requestCard = managerPage.locator('[class*="p-4"]').filter({ hasText: reason }).first()
  await expect(requestCard.getByRole('button', { name: 'Approve' })).toBeVisible()
  await requestCard.getByRole('button', { name: 'Approve' }).click()

  // The decision is recorded with an optional note, so it is confirmed in a
  // dialog rather than taken on the first click.
  const dialog = managerPage.getByRole('dialog')
  await dialog.getByLabel(/note/i).fill('Approved in the E2E walkthrough')
  await dialog.getByRole('button', { name: 'Approve' }).click()

  await expect(requestCard.getByText('APPROVED', { exact: true })).toBeVisible()

  await managerContext.close()
})
