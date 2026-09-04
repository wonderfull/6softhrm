import { Router } from 'express'
import { platformPrisma } from '../prismaClient'
import prisma from '../prismaClient'
import { requireAuth } from '../middleware/auth'
import { requireRole } from '../middleware/roles'
import { currentTenantId } from '../lib/tenantContext'
import { auditLog } from '../middleware/audit'
import { requireFeature } from '../lib/tenantPolicy'
import { DEFAULT_LEAVE_SETTINGS } from '../lib/tenantSettings'

const router = Router()

// The authenticated tenant's own profile — safe fields only.
router.get('/profile', requireAuth, async (_req, res) => {
  const tenant = await platformPrisma.tenant.findUnique({
    where: { id: currentTenantId() },
    select: {
      id: true,
      slug: true,
      name: true,
      status: true,
      plan: true,
      seatLimit: true,
      features: true,
      logoUrl: true,
      primaryColor: true,
      trialEndsAt: true,
    },
  })
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' })
  const activeEmployees = await prisma.employee.count({ where: { endDate: null } })
  res.json({ ...tenant, activeEmployees })
})

// Branding is the tenant admin's to change; commercial fields are not.
router.put('/profile', requireAuth, requireRole('ADMIN'), async (req: any, res) => {
  const { name, logoUrl, primaryColor } = req.body
  const data: any = {}
  if (name !== undefined) {
    if (!String(name).trim()) return res.status(400).json({ error: 'Company name cannot be empty' })
    data.name = String(name).trim()
  }
  if (logoUrl !== undefined) data.logoUrl = logoUrl ? String(logoUrl) : null
  if (primaryColor !== undefined) {
    if (primaryColor && !/^#[0-9a-fA-F]{6}$/.test(primaryColor)) {
      return res.status(400).json({ error: 'primaryColor must be a hex colour like #1d4f66' })
    }
    data.primaryColor = primaryColor || null
  }
  if (Object.keys(data).length === 0) return res.status(400).json({ error: 'Nothing to update' })

  const tenant = await platformPrisma.tenant.update({
    where: { id: currentTenantId() },
    data,
    select: { id: true, slug: true, name: true, plan: true, features: true, logoUrl: true, primaryColor: true },
  })
  await auditLog(req, 'UPDATE', 'Tenant', tenant.id, { fields: Object.keys(data) })
  res.json(tenant)
})

// Sponsor licence: one row per tenant, created on first save. Read by anyone
// who works the compliance screens; only the owner changes what the Home
// Office holds on file.
const LICENCE_RATINGS = new Set(['A', 'B'])
const LICENCE_DATE_FIELDS = ['expiryDate', 'allocationYearStart', 'actionPlanIssuedAt', 'actionPlanDueAt']
const LICENCE_TEXT_FIELDS = [
  'licenceNumber',
  'authorisingOfficer',
  'authorisingOfficerEmail',
  'keyContact',
  'keyContactEmail',
  'actionPlanNotes',
]

function parseUserList(value: unknown): { name: string; email: string }[] | null {
  if (value === null || value === undefined) return null
  if (!Array.isArray(value)) return null
  return value
    .map((u: any) => ({ name: String(u?.name ?? '').trim(), email: String(u?.email ?? '').trim() }))
    .filter((u) => u.name || u.email)
}

async function cosUsage(allocationYearStart: Date | null) {
  const since = allocationYearStart ? { cosAssignedDate: { gte: allocationYearStart } } : {}
  const [defined, undefinedCount] = await Promise.all([
    prisma.sponsorship.count({ where: { cosType: 'DEFINED', ...since } }),
    prisma.sponsorship.count({ where: { cosType: 'UNDEFINED', ...since } }),
  ])
  return { cosDefinedUsed: defined, cosUndefinedUsed: undefinedCount }
}

router.get(
  '/licence',
  requireAuth,
  requireFeature('compliance'),
  requireRole('ADMIN', 'DIRECTOR', 'OFFICE_ASSISTANT'),
  async (_req, res) => {
    const licence = await platformPrisma.sponsorLicence.findUnique({
      where: { tenantId: currentTenantId() },
    })
    const usage = await cosUsage(licence?.allocationYearStart ?? null)
    res.json({ licence, ...usage })
  },
)

router.put('/licence', requireAuth, requireFeature('compliance'), requireRole('ADMIN'), async (req: any, res) => {
  const body = req.body ?? {}
  const data: any = {}
  for (const field of LICENCE_TEXT_FIELDS) {
    if (body[field] !== undefined) data[field] = body[field] ? String(body[field]).trim() : null
  }
  if (body.rating !== undefined) {
    if (!LICENCE_RATINGS.has(body.rating)) return res.status(400).json({ error: 'rating must be A or B' })
    data.rating = body.rating
  }
  for (const field of LICENCE_DATE_FIELDS) {
    if (body[field] === undefined) continue
    if (!body[field]) {
      data[field] = null
      continue
    }
    const date = new Date(body[field])
    if (Number.isNaN(date.getTime())) return res.status(400).json({ error: `${field} must be a valid date` })
    data[field] = date
  }
  for (const field of ['cosDefinedAllocated', 'cosUndefinedAllocated']) {
    if (body[field] === undefined) continue
    const n = Number(body[field])
    if (!Number.isInteger(n) || n < 0) return res.status(400).json({ error: `${field} must be a whole number` })
    data[field] = n
  }
  for (const field of ['level1Users', 'level2Users']) {
    if (body[field] === undefined) continue
    const list = parseUserList(body[field])
    if (body[field] !== null && list === null) return res.status(400).json({ error: `${field} must be a list` })
    data[field] = list ?? []
  }
  if (Object.keys(data).length === 0) return res.status(400).json({ error: 'Nothing to update' })

  const licence = await platformPrisma.sponsorLicence.upsert({
    where: { tenantId: currentTenantId() },
    update: data,
    create: { tenantId: currentTenantId(), ...data },
  })
  await auditLog(req, 'UPDATE', 'SponsorLicence', licence.id, { fields: Object.keys(data) })
  const usage = await cosUsage(licence.allocationYearStart)
  res.json({ licence, ...usage })
})

// Leave policy and working calendar. Everyone who books or reviews leave
// needs to read it; only the owner sets it.
const BANK_HOLIDAY_REGIONS = new Set([
  'england-and-wales',
  'scotland',
  'northern-ireland',
])

const SETTINGS_SELECT = {
  leaveYearStart: true,
  defaultLeaveDays: true,
  carryoverCapDays: true,
  bankHolidayRegion: true,
  workingDays: true,
  companyAddress: true,
} as const

router.get('/settings', requireAuth, async (_req, res) => {
  const settings = await platformPrisma.tenantSettings.findUnique({
    where: { tenantId: currentTenantId() },
    select: SETTINGS_SELECT,
  })
  res.json(settings ?? { ...DEFAULT_LEAVE_SETTINGS, companyAddress: null })
})

router.put('/settings', requireAuth, requireRole('ADMIN'), async (req: any, res) => {
  const body = req.body ?? {}
  const data: any = {}

  if (body.leaveYearStart !== undefined) {
    if (!/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(String(body.leaveYearStart)))
      return res.status(400).json({ error: 'leaveYearStart must be MM-DD' })
    data.leaveYearStart = String(body.leaveYearStart)
  }
  for (const field of ['defaultLeaveDays', 'carryoverCapDays']) {
    if (body[field] === undefined) continue
    const n = Number(body[field])
    if (!Number.isFinite(n) || n < 0 || n > 365)
      return res.status(400).json({ error: `${field} must be between 0 and 365` })
    data[field] = n
  }
  if (body.bankHolidayRegion !== undefined) {
    if (!BANK_HOLIDAY_REGIONS.has(body.bankHolidayRegion))
      return res
        .status(400)
        .json({ error: `bankHolidayRegion must be one of ${[...BANK_HOLIDAY_REGIONS].join(', ')}` })
    data.bankHolidayRegion = body.bankHolidayRegion
  }
  if (body.workingDays !== undefined) {
    const days = String(body.workingDays)
      .split(',')
      .map((d) => d.trim())
      .filter(Boolean)
    if (days.length === 0 || days.some((d) => !/^[1-7]$/.test(d)))
      return res
        .status(400)
        .json({ error: 'workingDays must be ISO weekday numbers, e.g. 1,2,3,4,5' })
    data.workingDays = [...new Set(days)].sort().join(',')
  }
  if (body.companyAddress !== undefined) {
    data.companyAddress = body.companyAddress ? String(body.companyAddress).trim() : null
  }
  if (Object.keys(data).length === 0) return res.status(400).json({ error: 'Nothing to update' })

  const settings = await platformPrisma.tenantSettings.upsert({
    where: { tenantId: currentTenantId() },
    update: data,
    create: { tenantId: currentTenantId(), ...data },
    select: SETTINGS_SELECT,
  })
  await auditLog(req, 'UPDATE', 'TenantSettings', currentTenantId(), {
    fields: Object.keys(data),
  })
  res.json(settings)
})

export default router
