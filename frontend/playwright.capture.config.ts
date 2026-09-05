import { defineConfig } from '@playwright/test'

// Capture-only config: no globalSetup, because the E2E seed re-creates demo
// records and would overwrite the curated data the marketing shot needs.
export default defineConfig({
  testDir: './e2e',
  testMatch: 'capture-shot.spec.ts',
  timeout: 60_000,
  use: { baseURL: 'http://localhost:5173', headless: true },
  webServer: [
    { command: 'npm run dev', cwd: '../backend', url: 'http://localhost:4000/api/health', reuseExistingServer: true, timeout: 120_000 },
    { command: 'npm run dev -- --host localhost --port 5173', cwd: '.', url: 'http://localhost:5173/login', reuseExistingServer: true, timeout: 120_000 },
  ],
})
