import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'
import { E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD } from './helpers/accounts'

test('monthly timesheet view shows monthly summary state', async ({ page }) => {
  await loginAs(page, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD)
  await page.goto('/time')
  await page.getByRole('button', { name: 'Monthly' }).click()

  await expect(page.getByText('Total Hours')).toBeVisible()
  await expect(page.getByText('Days Worked')).toBeVisible()
  await expect(page.getByRole('button', { name: 'This Month' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'This Week' })).toHaveCount(0)
})

test('admin can upload a near-expiry document and see the expiry warning', async ({ page }) => {
  const documentName = `BDD Near Expiry Document ${Date.now()}`
  await loginAs(page, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD)
  await page.goto('/documents')

  await expect.poll(async () => page.locator('#document-employee option').count()).toBeGreaterThan(1)
  await page.locator('#document-employee').selectOption({ index: 1 })
  await page.getByLabel(/Document Name/i).fill(documentName)
  await page.getByLabel(/Document Type/i).selectOption('CONTRACT')

  const expiry = new Date()
  expiry.setDate(expiry.getDate() + 5)
  await page.getByLabel(/Expiry Date/i).fill(expiry.toISOString().slice(0, 10))

  await page.getByLabel(/File/i).setInputFiles({
    name: 'bdd-near-expiry.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('bdd pdf file'),
  })

  page.on('dialog', async (dialog) => {
    await dialog.accept()
  })

  await page.getByRole('button', { name: 'Upload Document' }).click()
  await expect(page.getByText(documentName)).toBeVisible()

  const row = page.locator('[class*="p-4"]').filter({ hasText: documentName }).first()
  await expect(row).toContainText(/Expires in|EXPIRED/)
})
