import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'

test('login page shows the current demo credentials', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByText('Admin: admin@example.com / password123')).toBeVisible()
  await expect(page.getByText('Manager: manager@example.com / password123')).toBeVisible()
  await expect(page.getByText('Employee: john.smith@company.com / password123')).toBeVisible()
})

test('admin can log in and see the dashboard shell', async ({ page }) => {
  await loginAs(page, 'admin@example.com', 'password123')
  await expect(page.getByRole('heading', { name: 'Welcome to 6Soft HRM' })).toBeVisible()
  await expect(page.getByText('Total Employees')).toBeVisible()
})

test('linked employee can log in with seeded credentials', async ({ page }) => {
  await loginAs(page, 'john.smith@company.com', 'password123')
  await expect(page.getByRole('heading', { name: 'Welcome to 6Soft HRM' })).toBeVisible()
  await expect(page.getByText('Pending Leave')).toBeVisible()
})
