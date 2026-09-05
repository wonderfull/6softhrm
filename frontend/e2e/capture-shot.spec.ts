import { test } from '@playwright/test'
import { loginAs } from './helpers/auth'
import { E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD } from './helpers/accounts'

// Regenerates the marketing screenshots and checks the brand surfaces. Not part
// of the E2E suite: it writes files and expects curated demo data.
test('brand surfaces render', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/login')
  await page.waitForTimeout(800)
  await page.screenshot({ path: 'public/brand/_login.png' })

  await page.goto('/')
  await page.waitForTimeout(800)
  await page.screenshot({ path: 'public/brand/_home.png', clip: { x: 0, y: 0, width: 1280, height: 120 } })

  await loginAs(page, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD)
  await page.goto('/reports')
  await page.waitForTimeout(1800)
  await page.screenshot({ path: 'public/marketing/reports.png' })
  await page.screenshot({ path: 'public/brand/_sidebar.png', clip: { x: 0, y: 0, width: 300, height: 300 } })
})
