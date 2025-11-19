import { beforeAll, afterAll } from '@jest/globals'

// Setup before all tests
beforeAll(() => {
  // Set test environment variables
  process.env.NODE_ENV = 'test'
  process.env.JWT_SECRET = 'test-secret-key'
  
  // Use separate test database to avoid wiping production data
  process.env.DATABASE_URL = 'mysql://root:Netscape99@localhost:3306/sixsoft_hrm_test'
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
