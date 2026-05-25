import { test, expect } from '@playwright/test';

// COS-7 / B4: an EMPLOYEE who navigates directly to /settings is bounced.
// Requires env: BASE_URL, EMPLOYEE_EMAIL, EMPLOYEE_PASSWORD.
test.skip(
  !process.env.EMPLOYEE_EMAIL || !process.env.EMPLOYEE_PASSWORD,
  'Set EMPLOYEE_EMAIL + EMPLOYEE_PASSWORD to run',
);

test('employee navigating to /settings is bounced to /dashboard', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(process.env.EMPLOYEE_EMAIL!);
  await page.getByLabel(/password/i).fill(process.env.EMPLOYEE_PASSWORD!);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/dashboard$/);

  await page.goto('/settings');
  await expect(page).toHaveURL(/\/dashboard$/);
});
