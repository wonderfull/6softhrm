import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'
import { E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, E2E_EMPLOYEE_EMAIL, E2E_EMPLOYEE_PASSWORD } from './helpers/accounts'

test('login page no longer exposes demo credentials', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByText('Demo Credentials:')).toHaveCount(0)
  await expect(page.getByText(/assigned company account/i)).toBeVisible()
})

test('admin can log in and see the dashboard shell', async ({ page }) => {
  await loginAs(page, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD)
  await expect(page.getByRole('heading', { name: 'Welcome to 6Soft HRM' })).toBeVisible()
  await expect(page.getByText('Total Employees')).toBeVisible()
})

test('linked employee can log in with assigned credentials', async ({ page }) => {
  await loginAs(page, E2E_EMPLOYEE_EMAIL, E2E_EMPLOYEE_PASSWORD)
  await expect(page.getByRole('heading', { name: 'Welcome to 6Soft HRM' })).toBeVisible()
  await expect(page.getByText('Pending Leave')).toBeVisible()
})
