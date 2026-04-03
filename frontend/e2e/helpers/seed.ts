import { expect, request as playwrightRequest } from '@playwright/test'

const backendBaseUrl = 'http://localhost:4000'

export async function seedDemoData() {
  const api = await playwrightRequest.newContext({ baseURL: backendBaseUrl })

  const loginResponse = await api.post('/api/auth/login', {
    data: {
      email: 'admin@example.com',
      password: 'password123',
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
