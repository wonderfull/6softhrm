import { Router } from 'express'
import prisma from '../prismaClient'
import { requireAuth } from '../middleware/auth'

const router = Router()

router.get('/', requireAuth, async (req, res) => {
  const items = await prisma.timesheet.findMany({ include: { employee: true, project: true } })
  res.json(items)
})

router.post('/', requireAuth, async (req, res) => {
  const { employeeId, projectId, date, hours, notes } = req.body
  if (!employeeId || !date || !hours) return res.status(400).json({ error: 'missing fields' })
  try {
    const data: any = {
      employeeId,
      date: new Date(date),
      hours: Number(hours),
      notes
    }
    if (projectId) data.projectId = projectId
    
    const ts = await prisma.timesheet.create({ data })
    res.json(ts)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

router.put('/:id', requireAuth, async (req, res) => {
  const { id } = req.params
  const { employeeId, projectId, date, hours, notes } = req.body
  try {
    const data: any = {}
    if (employeeId) data.employeeId = employeeId
    if (projectId !== undefined) data.projectId = projectId || null
    if (date) data.date = new Date(date)
    if (hours !== undefined) data.hours = Number(hours)
    if (notes !== undefined) data.notes = notes
    
    const ts = await prisma.timesheet.update({
      where: { id: parseInt(id) },
      data
    })
    res.json(ts)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

router.delete('/:id', requireAuth, async (req, res) => {
  const { id } = req.params
  try {
    await prisma.timesheet.delete({ where: { id: parseInt(id) } })
    res.json({ success: true })
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

export default router
