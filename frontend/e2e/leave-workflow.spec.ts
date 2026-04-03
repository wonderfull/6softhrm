import { test, expect } from '@playwright/test'
import { loginAs, logout } from './helpers/auth'

test('employee can submit leave and manager can approve it', async ({ browser }) => {
  const reason = `BDD leave workflow request ${Date.now()}`
  const employeeContext = await browser.newContext()
  const employeePage = await employeeContext.newPage()

  await loginAs(employeePage, 'john.smith@company.com', 'password123')
  await employeePage.goto('/leave')
  await employeePage.getByRole('button', { name: /Request Leave/i }).click()
  await employeePage.getByLabel('Leave Type *').selectOption('ANNUAL')
  await employeePage.getByLabel('Start Date *').fill('2026-06-10')
  await employeePage.getByLabel('End Date *').fill('2026-06-12')
  await employeePage.getByLabel('Reason').fill(reason)
  await employeePage.getByRole('button', { name: 'Submit Leave Request' }).click()
  const employeeRequestCard = employeePage.locator('[class*="p-4"]').filter({ hasText: reason }).first()
  await expect(employeeRequestCard).toBeVisible()

  await logout(employeePage)
  await employeeContext.close()

  const managerContext = await browser.newContext()
  const managerPage = await managerContext.newPage()

  await loginAs(managerPage, 'manager@example.com', 'password123')
  await managerPage.goto('/leave')
  await expect(managerPage.getByText('Review and approve employee leave requests.')).toBeVisible()

  const requestCard = managerPage.locator('[class*="p-4"]').filter({ hasText: reason }).first()
  await expect(requestCard.getByRole('button', { name: 'Approve' })).toBeVisible()
  await requestCard.getByRole('button', { name: 'Approve' }).click()
  await expect(requestCard.getByText('APPROVED')).toBeVisible()

  await managerContext.close()
})
