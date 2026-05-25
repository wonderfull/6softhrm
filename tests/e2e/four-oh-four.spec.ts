import { test, expect } from '@playwright/test';

// COS-7 / B11: unknown /api/* paths return JSON 404, not Express HTML.
test('unknown API path returns JSON 404', async ({ request }) => {
  const res = await request.get('/api/this-endpoint-does-not-exist');
  expect(res.status()).toBe(404);
  expect(res.headers()['content-type']).toContain('application/json');
  const body = await res.json();
  expect(body.error).toBeTruthy();
});

// COS-7 / B9: SPA renders the NotFound page (status will still be 200 from the
// SPA shell; this test asserts content, not the soft-404 status fix).
test('unknown SPA route renders Page not found', async ({ page }) => {
  await page.goto('/this-page-does-not-exist');
  await expect(page.getByText('Page not found')).toBeVisible();
});
