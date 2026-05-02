import { Router } from 'express'
import prisma from '../prismaClient'
import { requireAuth } from '../middleware/auth'
import { requireRole } from '../middleware/roles'
import { auditLog } from '../middleware/audit'
import { canViewSponsorships, normalizeRole, ROLES } from '../lib/roles'

const router = Router()

// List sponsorships
router.get('/', requireAuth, async (req: any, res) => {
  const user = req.user
  const role = normalizeRole(user?.role)

  if (role === ROLES.EMPLOYEE) {
    if (!user.employeeId) return res.json([])

    const ownItems = await prisma.sponsorship.findMany({
      where: { employeeId: user.employeeId },
      include: { employee: true },
    })
    await auditLog(req, 'READ', 'Sponsorship', undefined, {
      selfAccess: true,
      count: ownItems.length,
    })
    return res.json(ownItems)
  }

  if (!canViewSponsorships(role)) {
    return res.status(403).json({ error: 'forbidden' })
  }

  const items = await prisma.sponsorship.findMany({ include: { employee: true } })
  await auditLog(req, 'READ', 'Sponsorship', undefined, { count: items.length })
  res.json(items)
})

// Get expiring sponsorships (for dashboard alerts)
router.get('/expiring', requireAuth, async (req: any, res) => {
  try {
    const user = req.user
    const role = normalizeRole(user?.role)
    const now = new Date()
    const thirtyDaysFromNow = new Date()
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

    const whereClause: any = {
      endDate: {
        not: null,
        gte: now,
        lte: thirtyDaysFromNow,
      },
    }

    if (role === ROLES.EMPLOYEE) {
      if (!user.employeeId) return res.json([])
      whereClause.employeeId = user.employeeId
    } else if (!canViewSponsorships(role)) {
      return res.status(403).json({ error: 'forbidden' })
    }

    const expiringSponsorships = await prisma.sponsorship.findMany({
      where: whereClause,
      include: { employee: true },
      orderBy: { endDate: 'asc' },
    })

    await auditLog(req, 'READ', 'Sponsorship', undefined, {
      expiring: true,
      count: expiringSponsorships.length,
      selfAccess: role === ROLES.EMPLOYEE,
    })
    res.json(expiringSponsorships)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

// View sponsorship
router.get('/:id', requireAuth, async (req: any, res) => {
  const id = Number(req.params.id)
  const user = req.user
  const role = normalizeRole(user?.role)

  try {
    const sponsorship = await prisma.sponsorship.findUnique({
      where: { id },
      include: { employee: true },
    })
    if (!sponsorship) return res.status(404).json({ error: 'Sponsorship not found' })

    if (role === ROLES.EMPLOYEE) {
      if (!user.employeeId || sponsorship.employeeId !== user.employeeId) {
        return res.status(404).json({ error: 'Sponsorship not found' })
      }
    } else if (!canViewSponsorships(role)) {
      return res.status(403).json({ error: 'forbidden' })
    }

    await auditLog(req, 'READ', 'Sponsorship', sponsorship.id, {
      selfAccess: role === ROLES.EMPLOYEE,
    })
    res.json(sponsorship)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

// Create sponsorship
router.post('/', requireAuth, requireRole('ADMIN', 'DIRECTOR'), async (req: any, res) => {
  const { employeeId, visaType, casNumber, sponsorLicenseNumber, startDate, endDate, complianceNotes } = req.body
  if (!employeeId || !visaType || !startDate) return res.status(400).json({ error: 'missing fields' })
  try {
    const s = await prisma.sponsorship.create({
      data: {
        employeeId,
        visaType,
        casNumber,
        sponsorLicenseNumber,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : undefined,
        complianceNotes,
      },
    })
    await auditLog(req, 'CREATE', 'Sponsorship', s.id, {
      employeeId,
      visaType,
      sponsorLicenseNumber,
    })
    res.json(s)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

// Update sponsorship
router.put('/:id', requireAuth, requireRole('ADMIN', 'DIRECTOR'), async (req: any, res) => {
  const id = Number(req.params.id)
  try {
    const { startDate, endDate, ...rest } = req.body
    const data: any = { ...rest }
    if (startDate) data.startDate = new Date(startDate)
    if (endDate !== undefined) data.endDate = endDate ? new Date(endDate) : null
    
    const s = await prisma.sponsorship.update({ where: { id }, data })
    await auditLog(req, 'UPDATE', 'Sponsorship', s.id, {
      updatedFields: Object.keys(data),
    })
    res.json(s)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

// Delete
router.delete('/:id', requireAuth, requireRole('ADMIN', 'DIRECTOR'), async (req: any, res) => {
  const id = Number(req.params.id)
  try {
    const existing = await prisma.sponsorship.findUnique({ where: { id } })
    await prisma.sponsorship.delete({ where: { id } })
    await auditLog(req, 'DELETE', 'Sponsorship', id, {
      employeeId: existing?.employeeId,
      visaType: existing?.visaType,
    })
    res.json({ ok: true })
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

export default router
