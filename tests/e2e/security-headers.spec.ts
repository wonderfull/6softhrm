import { test, expect } from '@playwright/test';

// COS-7 / B2: every response should carry the security-headers snippet.
test('login page has the expected security headers', async ({ request }) => {
  const res = await request.get('/login');
  expect(res.status()).toBeLessThan(400);

  const h = res.headers();
  expect(h['strict-transport-security']).toBeDefined();
  expect(h['x-frame-options']?.toUpperCase()).toBe('DENY');
  expect(h['x-content-type-options']).toBe('nosniff');
  expect(h['content-security-policy']).toMatch(/frame-ancestors 'none'/);
  expect(h['referrer-policy']).toBeDefined();
  // Server banner should not advertise nginx version.
  expect(h['server']).not.toMatch(/nginx\/[\d.]+/);
});
