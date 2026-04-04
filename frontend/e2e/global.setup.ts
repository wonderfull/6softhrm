import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { expect, request as playwrightRequest, FullConfig } from '@playwright/test'
import { E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, E2E_EMPLOYEE_EMAIL, E2E_EMPLOYEE_PASSWORD, E2E_MANAGER_EMAIL, E2E_MANAGER_PASSWORD } from './helpers/accounts'

const backendDir = path.resolve(__dirname, '../../backend')
const backendBaseUrl = 'http://localhost:4000'

async function loginAsAdmin() {
  const api = await playwrightRequest.newContext({ baseURL: backendBaseUrl })
  const response = await api.post('/api/auth/login', {
    data: {
      email: E2E_ADMIN_EMAIL,
      password: E2E_ADMIN_PASSWORD,
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
  execFileSync('npx', ['prisma', 'db', 'push', '--accept-data-loss', '--skip-generate'], {
    cwd: backendDir,
    stdio: 'inherit',
    env: process.env,
  })

  let token = await loginAsAdmin()

  if (!token) {
    execFileSync('npm', ['run', 'seed'], {
      cwd: backendDir,
      stdio: 'inherit',
      env: {
        ...process.env,
        BOOTSTRAP_ADMIN_EMAIL: E2E_ADMIN_EMAIL,
        BOOTSTRAP_ADMIN_PASSWORD: E2E_ADMIN_PASSWORD,
        BOOTSTRAP_ADMIN_NAME: 'Operations Admin',
        BOOTSTRAP_MANAGER_EMAIL: E2E_MANAGER_EMAIL,
        BOOTSTRAP_MANAGER_PASSWORD: E2E_MANAGER_PASSWORD,
        BOOTSTRAP_MANAGER_NAME: 'Operations Manager',
      },
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

  const employeeUserResponse = await api.post('/api/auth/register', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    data: {
      email: E2E_EMPLOYEE_EMAIL,
      password: E2E_EMPLOYEE_PASSWORD,
      name: 'John Smith',
      role: 'USER',
    },
  })

  expect(
    employeeUserResponse.ok() || employeeUserResponse.status() === 400,
    `Employee user setup failed: ${employeeUserResponse.status()} ${await employeeUserResponse.text()}`
  ).toBeTruthy()

  const usersResponse = await api.get('/api/auth/users', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  expect(usersResponse.ok()).toBeTruthy()

  const users = await usersResponse.json()
  const employeeUser = users.find((user: any) => user.email === E2E_EMPLOYEE_EMAIL)

  expect(employeeUser, `No employee user found for ${E2E_EMPLOYEE_EMAIL}`).toBeTruthy()

  const resetEmployeePasswordResponse = await api.post(`/api/auth/users/${employeeUser.id}/reset-password`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    data: {
      newPassword: E2E_EMPLOYEE_PASSWORD,
    },
  })

  expect(resetEmployeePasswordResponse.ok()).toBeTruthy()

  await api.dispose()
}
