import { test, expect } from '@playwright/test';

// COS-7 / B4 (and prior COS-3 finding): Privacy / Terms / GDPR pages render
// real content rather than an empty shell.
const pages = [
  { path: '/privacy', heading: 'Privacy Policy' },
  { path: '/terms', heading: 'Terms of Service' },
  { path: '/gdpr', heading: 'GDPR Compliance' },
];

for (const { path, heading } of pages) {
  test(`${path} renders ${heading}`, async ({ page }) => {
    await page.goto(path);
    await expect(
      page.getByRole('heading', { name: heading, level: 1 }),
    ).toBeVisible();
  });
}
