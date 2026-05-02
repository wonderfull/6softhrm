import { beforeAll, afterAll, expect } from '@jest/globals'
import { execSync } from 'child_process'

// Setup before all tests
beforeAll(() => {
  // Set test environment variables
  process.env.NODE_ENV = 'test'
  process.env.JWT_SECRET = 'test-secret-key'

  const testPath = expect.getState().testPath || ''
  if (testPath.endsWith('roles.test.ts')) {
    return
  }

  // Prefer a dedicated test DB when configured, otherwise fall back to DATABASE_URL.
  if (process.env.TEST_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
  } else if (!process.env.DATABASE_URL) {
    throw new Error('Set TEST_DATABASE_URL or DATABASE_URL before running backend tests')
  }

  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    cwd: process.cwd(),
    stdio: 'ignore',
    env: {
      ...process.env,
      DATABASE_URL: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
    },
  })
})

// Cleanup after all tests
afterAll(() => {
  // Close any open connections
})

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
}
