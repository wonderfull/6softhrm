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
  const { employeeId, visaType, sponsorLicenseNumber, startDate, endDate, complianceNotes } = req.body
  if (!employeeId || !visaType || !startDate) return res.status(400).json({ error: 'missing fields' })
  try {
    const s = await prisma.sponsorship.create({
      data: {
        employeeId,
        visaType,
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
    const s = await prisma.sponsorship.update({ where: { id }, data: req.body })
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

export default router
