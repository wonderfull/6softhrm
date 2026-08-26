import { Router } from 'express'
import { platformPrisma } from '../prismaClient'
import prisma from '../prismaClient'
import { requireAuth } from '../middleware/auth'
import { requireRole } from '../middleware/roles'
import { currentTenantId } from '../lib/tenantContext'
import { auditLog } from '../middleware/audit'

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

export default router
