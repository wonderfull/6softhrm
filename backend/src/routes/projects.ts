import { Router } from 'express'
import prisma from '../prismaClient'
import { requireAuth } from '../middleware/auth'

const router = Router()

router.get('/', requireAuth, async (req, res) => {
  const projects = await prisma.project.findMany({ orderBy: { code: 'asc' } })
  res.json(projects)
})

router.post('/', requireAuth, async (req, res) => {
  const { code, name, description, active } = req.body
  if (!code || !name) return res.status(400).json({ error: 'Code and name are required' })
  
  try {
    const project = await prisma.project.create({
      data: { code, name, description, active: active !== false }
    })
    res.json(project)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

router.put('/:id', requireAuth, async (req, res) => {
  const { id } = req.params
  try {
    const project = await prisma.project.update({
      where: { id: parseInt(id) },
      data: req.body
    })
    res.json(project)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

router.delete('/:id', requireAuth, async (req, res) => {
  const { id } = req.params
  try {
    await prisma.project.delete({ where: { id: parseInt(id) } })
    res.json({ success: true })
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

export default router
