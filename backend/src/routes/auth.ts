import { Router } from 'express'
import prisma from '../prismaClient'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'
import { createAuditLog } from '../middleware/audit'

dotenv.config()

const router = Router()

router.post('/register', async (req, res) => {
  const { email, password, name, role } = req.body
  if (!email || !password) return res.status(400).json({ error: 'email and password required' })

  const hashed = await bcrypt.hash(password, 10)
  try {
    const userData: any = { email, password: hashed, name }
    if (role) userData.role = role

    // Auto-link to employee if email matches
    const employee = await prisma.employee.findUnique({ where: { email } })
    if (employee) {
      userData.employeeId = employee.id
    }

    const user = await prisma.user.create({ data: userData })
    res.json({ id: user.id, email: user.email, name: user.name, role: user.role })
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

// Manual link endpoint (to fix existing users)
router.post('/link-employee', async (req: any, res) => {
  const { email } = req.body
  if (!email) return res.status(400).json({ error: 'email required' })

  try {
    const user = await prisma.user.findUnique({ where: { email } })
    const employee = await prisma.employee.findUnique({ where: { email } })

    if (!user || !employee) {
      return res.status(404).json({ error: 'User or Employee not found' })
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { employeeId: employee.id }
    })

    res.json({ success: true, user: updated })
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

router.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'email and password required' })

  const user = await prisma.user.findUnique({
    where: { email },
    include: { employee: true }
  })
  if (!user) {
    await createAuditLog(null, email, 'LOGIN_FAILED', 'User', null, 'Invalid email', req)
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  const ok = await bcrypt.compare(password, user.password)
  if (!ok) {
    await createAuditLog(user.id, email, 'LOGIN_FAILED', 'User', user.id, 'Invalid password', req)
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  const secret = process.env.JWT_SECRET || 'change_me'
  const token = jwt.sign({
    id: user.id,
    email: user.email,
    role: user.role,
    employeeId: user.employeeId
  }, secret, { expiresIn: '8h' })

  await createAuditLog(user.id, email, 'LOGIN_SUCCESS', 'User', user.id, null, req)

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      employeeId: user.employeeId,
      employee: user.employee
    }
  })
})

// Get all users (admin only)
router.get('/users', async (req, res) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      employeeId: true,
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          jobTitle: true
        }
      },
      createdAt: true
    }
  })
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

// Forgot password - generate reset token
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body
  if (!email) return res.status(400).json({ error: 'Email required' })

  try {
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      // For security, don't reveal if email exists
      return res.json({ message: 'If the email exists, a reset link has been generated.' })
    }

    // Generate reset token (valid for 1 hour)
    const secret = process.env.JWT_SECRET || 'change_me'
    const resetToken = jwt.sign({ id: user.id, email: user.email, type: 'password-reset' }, secret, { expiresIn: '1h' })

    // In production, you would send this via email
    // For now, we'll return it in the response (for demo purposes)
    res.json({
      message: 'Password reset token generated',
      resetToken,
      resetLink: `${process.env.FRONTEND_URL || 'http://localhost:5174'}/reset-password?token=${resetToken}`
    })
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to process request' })
  }
})

// Reset password with token
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body
  if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password required' })

  try {
    const secret = process.env.JWT_SECRET || 'change_me'
    const decoded: any = jwt.verify(token, secret)

    // Verify it's a password reset token
    if (decoded.type !== 'password-reset') {
      return res.status(400).json({ error: 'Invalid reset token' })
    }

    // Update password
    const hashedPassword = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({
      where: { id: decoded.id },
      data: { password: hashedPassword }
    })

    res.json({ message: 'Password reset successful' })
  } catch (e: any) {
    if (e.name === 'TokenExpiredError') {
      return res.status(400).json({ error: 'Reset token has expired' })
    }
    res.status(400).json({ error: 'Invalid or expired reset token' })
  }
})

export default router
