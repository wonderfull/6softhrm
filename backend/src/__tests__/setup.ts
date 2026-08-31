import { beforeAll, afterAll, expect } from '@jest/globals'
import { execSync } from 'child_process'
import { initTestTenant } from './helpers/tenantTest'

// Set at module load, not in beforeAll: prismaClient is imported by the suites
// before any hook runs, and the field-encryption layer needs a key from the
// first query onwards.
process.env.FIELD_ENCRYPTION_KEY =
  process.env.FIELD_ENCRYPTION_KEY ||
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

// Setup before all tests
beforeAll(async () => {
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

  // Every suite gets its own tenant; tokens and fixtures scope to it via
  // the helpers in ./helpers/tenantTest.
  await initTestTenant()
}, 60000) // db push + tenant init can exceed the default 10s hook timeout

// Cleanup after all tests
afterAll(async () => {
  // Drop the shared Prisma connection so Jest can exit without --forceExit.
  const { platformPrisma } = await import('../prismaClient')
  await platformPrisma.$disconnect()
})

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
}
