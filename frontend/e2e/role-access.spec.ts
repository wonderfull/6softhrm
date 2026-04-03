import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'

test('manager is redirected away from admin-only routes', async ({ page }) => {
  await loginAs(page, 'manager@example.com', 'password123')

  await page.goto('/users')
  await expect(page).toHaveURL(/\/dashboard$/)

  await page.goto('/audit-logs')
  await expect(page).toHaveURL(/\/dashboard$/)

  await page.goto('/data-export')
  await expect(page).toHaveURL(/\/dashboard$/)
})

test('employee is redirected away from the user management route', async ({ page }) => {
  await loginAs(page, 'john.smith@company.com', 'password123')
  await page.goto('/users')
  await expect(page).toHaveURL(/\/dashboard$/)
})
