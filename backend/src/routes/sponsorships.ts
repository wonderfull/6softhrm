import { Router } from 'express'
import prisma from '../prismaClient'
import { requireAuth } from '../middleware/auth'
import { requireRole } from '../middleware/roles'

const router = Router()

// List sponsorships
router.get('/', requireAuth, async (req, res) => {
  const items = await prisma.sponsorship.findMany({ include: { employee: true } })
  res.json(items)
})

// Create sponsorship
router.post('/', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
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
    res.json(s)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

// Update sponsorship
router.put('/:id', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  const id = Number(req.params.id)
  try {
    const { startDate, endDate, ...rest } = req.body
    const data: any = { ...rest }
    if (startDate) data.startDate = new Date(startDate)
    if (endDate !== undefined) data.endDate = endDate ? new Date(endDate) : null
    
    const s = await prisma.sponsorship.update({ where: { id }, data })
    res.json(s)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

// Delete
router.delete('/:id', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  const id = Number(req.params.id)
  try {
    await prisma.sponsorship.delete({ where: { id } })
    res.json({ ok: true })
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

// Get expiring sponsorships (for dashboard alerts)
router.get('/expiring', requireAuth, async (req: any, res) => {
  try {
    const user = req.user
    const now = new Date()
    const thirtyDaysFromNow = new Date()
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
    
    const whereClause: any = {
      endDate: {
        not: null,
        gte: now,
        lte: thirtyDaysFromNow
      }
    }
    
    // If user is an employee, only show their own expiring sponsorships
    if (user.role === 'USER' && user.employeeId) {
      whereClause.employeeId = user.employeeId
    }
    
    const expiringSponsorships = await prisma.sponsorship.findMany({
      where: whereClause,
      include: { employee: true },
      orderBy: { endDate: 'asc' }
    })
    
    res.json(expiringSponsorships)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

export default router
