import { test, expect } from '@playwright/test';

// COS-7 / B10: real robots.txt + sitemap.xml served by nginx, not the SPA.
test('/robots.txt is plain text and disallows everything', async ({
  request,
}) => {
  const res = await request.get('/robots.txt');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toMatch(/text\/plain/);
  expect(await res.text()).toMatch(/Disallow: \//);
});

test('/sitemap.xml is XML', async ({ request }) => {
  const res = await request.get('/sitemap.xml');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toMatch(/xml/);
  expect(await res.text()).toContain('<urlset');
});
