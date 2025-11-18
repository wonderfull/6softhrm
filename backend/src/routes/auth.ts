import { Router } from 'express'
import prisma from '../prismaClient'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'

dotenv.config()

const router = Router()

router.post('/register', async (req, res) => {
  const { email, password, name, role } = req.body
  if (!email || !password) return res.status(400).json({ error: 'email and password required' })

  const hashed = await bcrypt.hash(password, 10)
  try {
    const userData: any = { email, password: hashed, name }
    if (role) userData.role = role
    
    const user = await prisma.user.create({ data: userData })
    res.json({ id: user.id, email: user.email, name: user.name, role: user.role })
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

router.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'email and password required' })

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return res.status(401).json({ error: 'Invalid credentials' })

  const ok = await bcrypt.compare(password, user.password)
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' })

  const secret = process.env.JWT_SECRET || 'change_me'
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, secret, { expiresIn: '8h' })
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } })
})

// Get all users (admin only)
router.get('/users', async (req, res) => {
  const users = await prisma.user.findMany({ select: { id: true, email: true, name: true, role: true, createdAt: true } })
  res.json(users)
})

// Update user (admin only)
router.put('/users/:id', async (req, res) => {
  const { email, name, role, password } = req.body
  const data: any = { email, name, role }
  if (password) {
    data.password = await bcrypt.hash(password, 10)
  }
  try {
    const user = await prisma.user.update({ where: { id: Number(req.params.id) }, data })
    res.json({ id: user.id, email: user.email, name: user.name, role: user.role })
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

// Delete user (admin only)
router.delete('/users/:id', async (req, res) => {
  try {
    await prisma.user.delete({ where: { id: Number(req.params.id) } })
    res.json({ ok: true })
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

export default router
