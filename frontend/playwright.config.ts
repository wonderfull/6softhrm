import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global.setup.ts',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'npm run dev',
      cwd: '../backend',
      // A browser suite drives far more requests through one IP than the
      // production limits allow, so without this the last specs to run get
      // 429s that look like empty pages rather than throttling.
      env: { ...process.env, E2E_RELAX_RATE_LIMITS: '1' } as Record<string, string>,
      url: 'http://localhost:4000/api/health',
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: 'npm run dev -- --host localhost --port 5173',
      cwd: '.',
      url: 'http://localhost:5173/login',
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
})
