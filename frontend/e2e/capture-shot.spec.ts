import { test } from '@playwright/test'
import { loginAs } from './helpers/auth'
import { E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD } from './helpers/accounts'

// Captures every key screen for the Claude Design handoff pack.
const OUT = process.env.SHOT_OUT || '../design-handoff/screens'

test('capture the handoff screens', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })

  await page.goto('/')
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${OUT}/01-landing-light.png`, fullPage: true })
  await page.evaluate(() => document.documentElement.classList.add('dark'))
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}/02-landing-dark.png`, fullPage: true })
  await page.evaluate(() => document.documentElement.classList.remove('dark'))

  await page.goto('/login')
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${OUT}/03-login.png` })

  await loginAs(page, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD)
  for (const [route, file] of [
    ['/dashboard', '04-dashboard.png'],
    ['/employees', '05-people.png'],
    ['/leave', '06-leave.png'],
    ['/reports', '07-reports.png'],
    ['/expenses', '08-expenses.png'],
    ['/settings', '09-settings.png'],
  ] as const) {
    await page.goto(route)
    await page.waitForTimeout(1800)
    await page.screenshot({ path: `${OUT}/${file}` })
  }

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.waitForTimeout(1000)
  await page.screenshot({ path: `${OUT}/10-landing-mobile.png`, fullPage: true })
})
