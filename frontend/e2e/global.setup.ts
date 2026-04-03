import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { expect, request as playwrightRequest, FullConfig } from '@playwright/test'

const backendDir = path.resolve(__dirname, '../../backend')
const backendBaseUrl = 'http://localhost:4000'

async function loginAsAdmin() {
  const api = await playwrightRequest.newContext({ baseURL: backendBaseUrl })
  const response = await api.post('/api/auth/login', {
    data: {
      email: 'admin@example.com',
      password: 'password123',
    },
  })

  if (!response.ok()) {
    await api.dispose()
    return null
  }

  const data = await response.json()
  await api.dispose()
  return data.token as string
}

export default async function globalSetup(_config: FullConfig) {
  let token = await loginAsAdmin()

  if (!token) {
    execFileSync('npm', ['run', 'seed'], {
      cwd: backendDir,
      stdio: 'inherit',
    })
    token = await loginAsAdmin()
  }

  expect(token).toBeTruthy()

  const api = await playwrightRequest.newContext({ baseURL: backendBaseUrl })
  const seedResponse = await api.post('/api/admin/seed-data', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const seedBody = await seedResponse.text()
  expect(seedResponse.ok(), `Seed request failed: ${seedResponse.status()} ${seedBody}`).toBeTruthy()
  await api.dispose()
}
