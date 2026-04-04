import { expect, request as playwrightRequest } from '@playwright/test'
import { E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD } from './accounts'

const backendBaseUrl = 'http://localhost:4000'

export async function seedDemoData() {
  const api = await playwrightRequest.newContext({ baseURL: backendBaseUrl })

  const loginResponse = await api.post('/api/auth/login', {
    data: {
      email: E2E_ADMIN_EMAIL,
      password: E2E_ADMIN_PASSWORD,
    },
  })

  expect(loginResponse.ok()).toBeTruthy()
  const loginData = await loginResponse.json()

  const seedResponse = await api.post('/api/admin/seed-data', {
    headers: {
      Authorization: `Bearer ${loginData.token}`,
    },
  })

  expect(seedResponse.ok()).toBeTruthy()
  await api.dispose()
}
