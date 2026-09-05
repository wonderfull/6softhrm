import { test } from '@playwright/test'

// Regenerates the marketing screenshots and gives the landing page a visual
// check in both themes. Not part of the E2E suite: it writes files and expects
// curated demo data. Run with playwright.capture.config.ts.
test('capture the landing page in both themes', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.waitForTimeout(1200)
  await page.screenshot({ path: 'public/marketing/_check-light.png' })

  await page.emulateMedia({ colorScheme: 'dark' })
  await page.evaluate(() => document.documentElement.classList.add('dark'))
  await page.waitForTimeout(600)
  await page.screenshot({ path: 'public/marketing/_check-dark.png' })
})
