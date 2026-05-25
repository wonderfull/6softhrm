import { test, expect } from '@playwright/test';

// COS-7 / B1: the public share-link feature was removed entirely.
test('GET /api/documents/share/<anything> no longer exists', async ({
  request,
}) => {
  const res = await request.get('/api/documents/share/anything-at-all');
  expect(res.status()).toBe(404);
  const body = await res.json();
  expect(body.error).toBeTruthy();
});
