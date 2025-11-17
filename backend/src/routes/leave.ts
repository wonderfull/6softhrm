import { Router } from 'express'
import prisma from '../prismaClient'
import { requireAuth } from '../middleware/auth'
import { requireRole } from '../middleware/roles'

const router = Router()

router.get('/', requireAuth, async (req, res) => {
  const leaves = await prisma.leaveRequest.findMany({ include: { employee: true } })
  res.json(leaves)
})

router.post('/', requireAuth, async (req, res) => {
  const { employeeId, type, startDate, endDate, reason } = req.body
  if (!employeeId || !type || !startDate || !endDate) return res.status(400).json({ error: 'missing fields' })
  try {
    const lr = await prisma.leaveRequest.create({
      data: { employeeId, type, startDate: new Date(startDate), endDate: new Date(endDate), reason },
    })
    res.json(lr)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

router.put('/:id/approve', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  const id = Number(req.params.id)
  try {
    const lr = await prisma.leaveRequest.update({ where: { id }, data: { status: 'APPROVED' } })
    res.json(lr)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

router.put('/:id/reject', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  const id = Number(req.params.id)
  try {
    const lr = await prisma.leaveRequest.update({ where: { id }, data: { status: 'REJECTED' } })
    res.json(lr)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

export default router
