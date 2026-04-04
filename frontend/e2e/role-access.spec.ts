import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'
import { E2E_EMPLOYEE_EMAIL, E2E_EMPLOYEE_PASSWORD, E2E_MANAGER_EMAIL, E2E_MANAGER_PASSWORD } from './helpers/accounts'

test('manager is redirected away from admin-only routes', async ({ page }) => {
  await loginAs(page, E2E_MANAGER_EMAIL, E2E_MANAGER_PASSWORD)

  await page.goto('/users')
  await expect(page).toHaveURL(/\/dashboard$/)

  await page.goto('/audit-logs')
  await expect(page).toHaveURL(/\/dashboard$/)

  await page.goto('/data-export')
  await expect(page).toHaveURL(/\/dashboard$/)
})

test('employee is redirected away from the user management route', async ({ page }) => {
  await loginAs(page, E2E_EMPLOYEE_EMAIL, E2E_EMPLOYEE_PASSWORD)
  await page.goto('/users')
  await expect(page).toHaveURL(/\/dashboard$/)
})
