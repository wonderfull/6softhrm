import { Router } from 'express'
import prisma from '../prismaClient'
import { requireAuth } from '../middleware/auth'
import { currentTenantId } from '../lib/tenantContext'

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
      data: { tenantId: currentTenantId(), code, name, description, active: active !== false }
    })
    res.json(project)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

router.put('/:id', requireAuth, async (req, res) => {
  const { id } = req.params
  // Explicit field pick — never spread req.body into update data.
  const { code, name, description, active } = req.body
  const data: any = {}
  if (code !== undefined) data.code = code
  if (name !== undefined) data.name = name
  if (description !== undefined) data.description = description
  if (active !== undefined) data.active = active
  try {
    const updated = await prisma.project.updateMany({
      where: { id: parseInt(id) },
      data
    })
    if (updated.count === 0) return res.status(404).json({ error: 'Project not found' })
    const project = await prisma.project.findFirst({ where: { id: parseInt(id) } })
    res.json(project)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

router.delete('/:id', requireAuth, async (req, res) => {
  const { id } = req.params
  try {
    const deleted = await prisma.project.deleteMany({ where: { id: parseInt(id) } })
    if (deleted.count === 0) return res.status(404).json({ error: 'Project not found' })
    res.json({ success: true })
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

export default router
