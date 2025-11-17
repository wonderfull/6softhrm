import { Router } from 'express'
import prisma from '../prismaClient'
import { requireAuth } from '../middleware/auth'

const router = Router()

router.get('/', requireAuth, async (req, res) => {
  const employees = await prisma.employee.findMany({ include: { sponsorships: true, documents: true } })
  res.json(employees)
})

router.post('/', requireAuth, async (req, res) => {
  const data = req.body
  try {
    // Convert startDate to DateTime if provided, otherwise set to undefined
    if (data.startDate && data.startDate !== '') {
      data.startDate = new Date(data.startDate)
    } else {
      data.startDate = undefined
    }
    
    // Convert endDate to DateTime if provided
    if (data.endDate && data.endDate !== '') {
      data.endDate = new Date(data.endDate)
    } else {
      data.endDate = undefined
    }

    const emp = await prisma.employee.create({ data })
    res.json(emp)
  } catch (e: any) {
    console.error('Error creating employee:', e)
    res.status(400).json({ error: e.message })
  }
})

router.put('/:id', requireAuth, async (req, res) => {
  const { id } = req.params
  const data = req.body
  try {
    // Convert dates
    if (data.startDate && data.startDate !== '') {
      data.startDate = new Date(data.startDate)
    } else if (data.startDate === '') {
      data.startDate = null
    }
    
    if (data.endDate && data.endDate !== '') {
      data.endDate = new Date(data.endDate)
    } else if (data.endDate === '') {
      data.endDate = null
    }

    const emp = await prisma.employee.update({
      where: { id: parseInt(id) },
      data
    })
    res.json(emp)
  } catch (e: any) {
    console.error('Error updating employee:', e)
    res.status(400).json({ error: e.message })
  }
})

router.delete('/:id', requireAuth, async (req, res) => {
  const { id } = req.params
  try {
    await prisma.employee.delete({
      where: { id: parseInt(id) }
    })
    res.json({ success: true })
  } catch (e: any) {
    console.error('Error deleting employee:', e)
    res.status(400).json({ error: e.message })
  }
})

export default router
