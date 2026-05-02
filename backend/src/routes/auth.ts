import { Router } from 'express'
import prisma from '../prismaClient'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'
import { createAuditLog } from '../middleware/audit'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { requireRole } from '../middleware/roles'
import { getJwtSecret } from '../lib/authConfig'
import { sendEmail } from '../lib/emailService'
import {
  canManageUserAccounts,
  normalizeRole,
  requireAssignableRole,
  ROLES,
} from '../lib/roles'

dotenv.config()

const router = Router()

function getOptionalUser(req: AuthRequest) {
  const header = req.headers.authorization
  if (!header) return null

  try {
    const token = header.replace('Bearer ', '')
    const secret = getJwtSecret()
    return jwt.verify(token, secret) as any
  } catch {
    return null
  }
}

function createPasswordResetPayload(user: { id: number; email: string }) {
  const secret = getJwtSecret()
  const resetToken = jwt.sign({ id: user.id, email: user.email, type: 'password-reset' }, secret, { expiresIn: '1h' })

  return {
    resetToken,
    resetLink: `${process.env.FRONTEND_URL || 'http://localhost:5174'}/reset-password?token=${resetToken}`
  }
}

async function sendPasswordResetEmail(email: string, resetLink: string) {
  return sendEmail({
    to: email,
    subject: 'Reset your 6Soft HRM password',
    text: `Use this link to reset your password: ${resetLink}`,
    html: `
      <p>A password reset was requested for your 6Soft HRM account.</p>
      <p><a href="${resetLink}">Reset your password</a></p>
      <p>If you did not request this, you can ignore this email.</p>
    `,
  })
}

router.post('/register', async (req: AuthRequest, res) => {
  const { email, password, name, role } = req.body
  if (!email || !password) return res.status(400).json({ error: 'email and password required' })

  const hashed = await bcrypt.hash(password, 10)
  try {
    const requester = getOptionalUser(req)
    const requesterRole = normalizeRole(requester?.role)
    const requestedRole = normalizeRole(role)
    const assignedRole = canManageUserAccounts(requesterRole)
      ? requireAssignableRole(requesterRole, requestedRole)
      : ROLES.EMPLOYEE
    const userData: any = {
      email,
      password: hashed,
      name,
      role: assignedRole,
    }

    // Auto-link to employee if email matches
    const employee = await prisma.employee.findUnique({ where: { email } })
    if (employee) {
      userData.employeeId = employee.id
    }

    const user = await prisma.user.create({ data: userData })
    res.json({ id: user.id, email: user.email, name: user.name, role: normalizeRole(user.role) })
  } catch (e: any) {
    const status = /permission/i.test(e.message) ? 403 : 400
    res.status(status).json({ error: e.message })
  }
})

// Manual link endpoint (to fix existing users)
router.post('/link-employee', requireAuth, requireRole('ADMIN', 'DIRECTOR'), async (req: any, res) => {
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

  try {
    const secret = getJwtSecret()
    const role = normalizeRole(user.role)
    const token = jwt.sign({
      id: user.id,
      email: user.email,
      role,
      employeeId: user.employeeId
    }, secret, { expiresIn: '8h' })

    await createAuditLog(user.id, email, 'LOGIN_SUCCESS', 'User', user.id, null, req)

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role,
        employeeId: user.employeeId,
        employee: user.employee
      }
    })
  } catch (e: any) {
    res.status(500).json({ error: 'Authentication configuration error' })
  }
})

// Get all users
router.get('/users', requireAuth, requireRole('ADMIN', 'DIRECTOR'), async (req, res) => {
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
  res.json(users.map((user) => ({ ...user, role: normalizeRole(user.role) })))
})

// Update user
router.put('/users/:id', requireAuth, requireRole('ADMIN', 'DIRECTOR'), async (req: AuthRequest, res) => {
  const { email, name, role, password, employeeId } = req.body
  try {
    const existingUser = await prisma.user.findUnique({ where: { id: Number(req.params.id) } })
    if (!existingUser) return res.status(404).json({ error: 'User not found' })

    const requesterRole = normalizeRole(req.user?.role)
    if (normalizeRole(existingUser.role) === ROLES.ADMIN && requesterRole !== ROLES.ADMIN) {
      return res.status(403).json({ error: 'You do not have permission to manage admin accounts' })
    }

    const data: any = { email, name }
    if (role !== undefined) {
      data.role = requireAssignableRole(requesterRole, role)
    }
    if (password) {
      data.password = await bcrypt.hash(password, 10)
    }
    if (employeeId !== undefined) {
      data.employeeId = employeeId || null
    }

    const user = await prisma.user.update({ where: { id: Number(req.params.id) }, data })
    res.json({ id: user.id, email: user.email, name: user.name, role: normalizeRole(user.role) })
  } catch (e: any) {
    const status = /permission/i.test(e.message) ? 403 : 400
    res.status(status).json({ error: e.message })
  }
})

router.post('/users/:id/reset-link', requireAuth, requireRole('ADMIN', 'DIRECTOR'), async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: Number(req.params.id) } })
    if (!user) return res.status(404).json({ error: 'User not found' })
    if (normalizeRole(user.role) === ROLES.ADMIN && normalizeRole(req.user?.role) !== ROLES.ADMIN) {
      return res.status(403).json({ error: 'You do not have permission to manage admin accounts' })
    }

    const payload = createPasswordResetPayload(user)
    const deliveryAttempted = await sendPasswordResetEmail(user.email, payload.resetLink)
    await createAuditLog(req.user?.id, req.user?.email, 'PASSWORD_RESET_LINK_GENERATED', 'User', user.id, null, req)

    res.json({
      message: deliveryAttempted
        ? 'Password reset link generated and sent if delivery is configured.'
        : 'Password reset link generated. Configure SMTP to send reset emails.'
    })
  } catch (e: any) {
    const status = e?.message === 'JWT_SECRET is not configured securely' ? 500 : 400
    res.status(status).json({ error: e?.message || 'Failed to generate password reset link' })
  }
})

router.post('/users/:id/reset-password', requireAuth, requireRole('ADMIN', 'DIRECTOR'), async (req: AuthRequest, res) => {
  const { newPassword } = req.body
  if (!newPassword) return res.status(400).json({ error: 'newPassword required' })

  try {
    const user = await prisma.user.findUnique({ where: { id: Number(req.params.id) } })
    if (!user) return res.status(404).json({ error: 'User not found' })
    if (normalizeRole(user.role) === ROLES.ADMIN && normalizeRole(req.user?.role) !== ROLES.ADMIN) {
      return res.status(403).json({ error: 'You do not have permission to manage admin accounts' })
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    })

    await createAuditLog(req.user?.id, req.user?.email, 'PASSWORD_RESET_BY_ADMIN', 'User', user.id, null, req)

    res.json({ message: 'Password reset successful' })
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

// Delete user
router.delete('/users/:id', requireAuth, requireRole('ADMIN', 'DIRECTOR'), async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: Number(req.params.id) } })
    if (!user) return res.status(404).json({ error: 'User not found' })
    if (normalizeRole(user.role) === ROLES.ADMIN && normalizeRole(req.user?.role) !== ROLES.ADMIN) {
      return res.status(403).json({ error: 'You do not have permission to manage admin accounts' })
    }

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

    const payload = createPasswordResetPayload(user)
    await sendPasswordResetEmail(user.email, payload.resetLink)

    res.json({
      message: 'If the email exists, a reset link has been generated.'
    })
  } catch (e: any) {
    const status = e?.message === 'JWT_SECRET is not configured securely' ? 500 : 500
    res.status(status).json({ error: 'Failed to process request' })
  }
})

// Reset password with token
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body
  if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password required' })

  try {
    const secret = getJwtSecret()
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
    if (e.message === 'JWT_SECRET is not configured securely') {
      return res.status(500).json({ error: 'Authentication configuration error' })
    }
    if (e.name === 'TokenExpiredError') {
      return res.status(400).json({ error: 'Reset token has expired' })
    }
    res.status(400).json({ error: 'Invalid or expired reset token' })
  }
})

export default router
