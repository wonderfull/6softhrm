import { Router } from 'express'
import prisma from '../prismaClient'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'

dotenv.config()

const router = Router()

router.post('/register', async (req, res) => {
  const { email, password, name } = req.body
  if (!email || !password) return res.status(400).json({ error: 'email and password required' })

  const hashed = await bcrypt.hash(password, 10)
  try {
    const user = await prisma.user.create({ data: { email, password: hashed, name } })
    res.json({ id: user.id, email: user.email })
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
  res.json({ token })
})

export default router
