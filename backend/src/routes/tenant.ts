import { Router } from 'express'
import { platformPrisma } from '../prismaClient'
import prisma from '../prismaClient'
import { requireAuth } from '../middleware/auth'
import { requireRole } from '../middleware/roles'
import { currentTenantId } from '../lib/tenantContext'
import { auditLog } from '../middleware/audit'
import { requireFeature } from '../lib/tenantPolicy'

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

export default router
