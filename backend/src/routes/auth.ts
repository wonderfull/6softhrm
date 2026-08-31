import { Request, Router } from 'express'
import prisma, { platformPrisma } from '../prismaClient'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'
import { createAuditLog } from '../middleware/audit'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { requireRole } from '../middleware/roles'
import { getJwtSecret } from '../lib/authConfig'
import { sendEmail } from '../lib/emailService'
import QRCode from 'qrcode'
import { generateTotpSecret, totpKeyUri, verifyTotp } from '../lib/totp'
import { lockoutMessage, loginThrottle } from '../lib/loginThrottle'
import { throttleLoginByAccount } from '../middleware/loginThrottle'
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
    subject: 'Reset your OnsideHR password',
    text: `Use this link to reset your password: ${resetLink}`,
    html: `
      <p>A password reset was requested for your OnsideHR account.</p>
      <p><a href="${resetLink}">Reset your password</a></p>
      <p>If you did not request this, you can ignore this email.</p>
    `,
  })
}

// Public registration must resolve a tenant before it can create anything.
// An authenticated admin/director registers into their own tenant; a
// self-service signup is only accepted when HR has already created an
// employee record with that email (which pins the tenant).
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

    let tenantId: number | null = requester?.tenantId ?? null
    const employeeMatches = await platformPrisma.employee.findMany({ where: { email } })
    let employee = null
    if (tenantId) {
      employee = employeeMatches.find((e) => e.tenantId === tenantId) ?? null
    } else if (employeeMatches.length === 1) {
      employee = employeeMatches[0]
      tenantId = employee.tenantId
    }

    if (!tenantId) {
      return res.status(403).json({
        error: 'No employee record found for this email. Ask your HR admin to create your account.',
      })
    }

    const userData: any = {
      tenantId,
      email,
      password: hashed,
      name,
      role: assignedRole,
    }
    if (employee) {
      userData.employeeId = employee.id
    }

    const user = await platformPrisma.user.create({ data: userData })
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
    const user = await prisma.user.findFirst({ where: { email } })
    const employee = await prisma.employee.findFirst({ where: { email } })

    if (!user || !employee) {
      return res.status(404).json({ error: 'User or Employee not found' })
    }

    await prisma.user.updateMany({
      where: { id: user.id },
      data: { employeeId: employee.id }
    })
    const updated = await prisma.user.findFirst({ where: { id: user.id } })

    res.json({ success: true, user: updated })
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

// Counts a failed login against the account and, on the attempt that trips
// the lockout, writes a single audit row. Called for unknown emails too, so
// a locked non-existent account behaves exactly like a locked real one.
async function registerFailedLogin(
  req: Request,
  email: string,
  userId: number | null,
  tenantId: number | null,
) {
  const { locked, failures, retryAfterMs } = loginThrottle.registerFailure(email)
  if (!locked) return
  await createAuditLog(
    userId,
    email,
    'LOGIN_LOCKED_OUT',
    'User',
    userId,
    `${failures} failed attempts; locked for ${Math.ceil(retryAfterMs / 60000)}m`,
    req,
    tenantId,
  )
}

function issueSessionToken(user: any) {
  const secret = getJwtSecret()
  const role = normalizeRole(user.role)
  const token = jwt.sign({
    id: user.id,
    email: user.email,
    role,
    employeeId: user.employeeId,
    tenantId: user.tenantId,
    tokenVersion: user.tokenVersion
  }, secret, { expiresIn: '8h' })
  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role,
      employeeId: user.employeeId,
      employee: user.employee,
      tenant: user.tenant && {
        id: user.tenant.id,
        slug: user.tenant.slug,
        name: user.tenant.name,
        plan: user.tenant.plan,
        features: user.tenant.features,
        logoUrl: user.tenant.logoUrl,
        primaryColor: user.tenant.primaryColor,
      }
    }
  }
}

router.post('/login', throttleLoginByAccount(), async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'email and password required' })

  // Pre-auth by definition: the email IS the tenant resolver, so this lookup
  // must be cross-tenant. User.email is globally unique.
  const user = await platformPrisma.user.findUnique({
    where: { email },
    include: { employee: true, tenant: true }
  })
  if (!user) {
    await createAuditLog(null, email, 'LOGIN_FAILED', 'User', null, 'Invalid email', req, null)
    await registerFailedLogin(req, email, null, null)
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  const ok = await bcrypt.compare(password, user.password)
  if (!ok) {
    await createAuditLog(user.id, email, 'LOGIN_FAILED', 'User', user.id, 'Invalid password', req, user.tenantId)
    await registerFailedLogin(req, email, user.id, user.tenantId)
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  // Credentials were correct: this was never a brute-force run, so clear the
  // counter before the tenant-status and 2FA branches below.
  loginThrottle.reset(email)

  if (user.tenant.status === 'SUSPENDED' || user.tenant.status === 'CANCELLED' || user.tenant.deletedAt) {
    await createAuditLog(user.id, email, 'LOGIN_BLOCKED_TENANT_STATUS', 'User', user.id, user.tenant.status, req, user.tenantId)
    return res.status(403).json({ error: 'This account is currently unavailable. Contact your administrator.' })
  }

  try {
    // Second factor: password is verified, but the session token is only
    // issued after a valid TOTP code.
    if (user.totpEnabled && user.totpSecret) {
      const secret = getJwtSecret()
      const pendingToken = jwt.sign(
        { id: user.id, type: '2fa-pending' },
        secret,
        { expiresIn: '5m' },
      )
      await createAuditLog(user.id, email, 'LOGIN_2FA_REQUIRED', 'User', user.id, null, req, user.tenantId)
      return res.json({ requires2fa: true, pendingToken })
    }

    await createAuditLog(user.id, email, 'LOGIN_SUCCESS', 'User', user.id, null, req, user.tenantId)
    res.json(issueSessionToken(user))
  } catch (e: any) {
    res.status(500).json({ error: 'Authentication configuration error' })
  }
})

// Complete a 2FA login: pending token + valid TOTP code → session token.
router.post('/2fa/complete', async (req, res) => {
  const { pendingToken, code } = req.body
  if (!pendingToken || !code) return res.status(400).json({ error: 'pendingToken and code required' })
  try {
    const secret = getJwtSecret()
    const decoded: any = jwt.verify(pendingToken, secret)
    if (decoded.type !== '2fa-pending') return res.status(401).json({ error: 'Invalid token' })

    const user = await platformPrisma.user.findUnique({
      where: { id: decoded.id },
      include: { employee: true, tenant: true },
    })
    if (!user || !user.totpEnabled || !user.totpSecret) {
      return res.status(401).json({ error: 'Invalid token' })
    }
    // A pending token stays valid for five minutes, and a TOTP code is only
    // six digits — without a throttle that window allows an unbounded number
    // of guesses at a 1-in-a-million secret.
    const totpKey = `2fa:${user.id}`
    const totpLock = loginThrottle.check(totpKey)
    if (totpLock.locked) {
      res.set('Retry-After', String(Math.ceil(totpLock.retryAfterMs / 1000)))
      return res.status(429).json({ error: lockoutMessage(totpLock.retryAfterMs) })
    }

    if (!verifyTotp(String(code), user.totpSecret)) {
      await createAuditLog(user.id, user.email, 'LOGIN_2FA_FAILED', 'User', user.id, null, req, user.tenantId)
      const { locked, failures, retryAfterMs } = loginThrottle.registerFailure(totpKey)
      if (locked) {
        await createAuditLog(
          user.id,
          user.email,
          'LOGIN_2FA_LOCKED_OUT',
          'User',
          user.id,
          `${failures} failed codes; locked for ${Math.ceil(retryAfterMs / 60000)}m`,
          req,
          user.tenantId,
        )
      }
      return res.status(401).json({ error: 'Invalid authentication code' })
    }

    loginThrottle.reset(totpKey)
    await createAuditLog(user.id, user.email, 'LOGIN_SUCCESS', 'User', user.id, '2FA', req, user.tenantId)
    res.json(issueSessionToken(user))
  } catch (e: any) {
    if (e.message === 'JWT_SECRET is not configured securely') {
      return res.status(500).json({ error: 'Authentication configuration error' })
    }
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
})

// Begin 2FA enrolment: store a pending secret, return otpauth URI + QR.
router.post('/2fa/setup', requireAuth, async (req: any, res) => {
  try {
    const user = await prisma.user.findFirst({ where: { id: req.user.id } })
    if (!user) return res.status(404).json({ error: 'User not found' })
    if (user.totpEnabled) return res.status(400).json({ error: '2FA is already enabled' })

    const totpSecret = generateTotpSecret()
    await prisma.user.updateMany({ where: { id: user.id }, data: { totpSecret } })
    const otpauth = totpKeyUri(user.email, 'OnsideHR', totpSecret)
    const qrDataUrl = await QRCode.toDataURL(otpauth)
    res.json({ otpauth, qrDataUrl })
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

// Confirm enrolment with a valid code.
router.post('/2fa/enable', requireAuth, async (req: any, res) => {
  const { code } = req.body
  if (!code) return res.status(400).json({ error: 'code required' })
  const user = await prisma.user.findFirst({ where: { id: req.user.id } })
  if (!user?.totpSecret) return res.status(400).json({ error: 'Run 2FA setup first' })
  if (!verifyTotp(String(code), user.totpSecret)) {
    return res.status(400).json({ error: 'Invalid authentication code — check your authenticator app' })
  }
  await prisma.user.updateMany({ where: { id: user.id }, data: { totpEnabled: true } })
  await createAuditLog(user.id, user.email, '2FA_ENABLED', 'User', user.id, null, req)
  res.json({ enabled: true })
})

// Disable requires a current code (stolen-session protection).
router.post('/2fa/disable', requireAuth, async (req: any, res) => {
  const { code } = req.body
  const user = await prisma.user.findFirst({ where: { id: req.user.id } })
  if (!user?.totpEnabled || !user.totpSecret) {
    return res.status(400).json({ error: '2FA is not enabled' })
  }
  if (!code || !verifyTotp(String(code), user.totpSecret)) {
    return res.status(400).json({ error: 'A valid authentication code is required to disable 2FA' })
  }
  await prisma.user.updateMany({
    where: { id: user.id },
    data: { totpEnabled: false, totpSecret: null },
  })
  await createAuditLog(user.id, user.email, '2FA_DISABLED', 'User', user.id, null, req)
  res.json({ enabled: false })
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
    const existingUser = await prisma.user.findFirst({ where: { id: Number(req.params.id) } })
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
      data.tokenVersion = { increment: 1 }
    }
    if (employeeId !== undefined) {
      data.employeeId = employeeId || null
    }

    await prisma.user.updateMany({ where: { id: existingUser.id }, data })
    const user = await prisma.user.findFirst({ where: { id: existingUser.id } })
    if (!user) return res.status(404).json({ error: 'User not found' })
    res.json({ id: user.id, email: user.email, name: user.name, role: normalizeRole(user.role) })
  } catch (e: any) {
    const status = /permission/i.test(e.message) ? 403 : 400
    res.status(status).json({ error: e.message })
  }
})

router.post('/users/:id/reset-link', requireAuth, requireRole('ADMIN', 'DIRECTOR'), async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findFirst({ where: { id: Number(req.params.id) } })
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
    const user = await prisma.user.findFirst({ where: { id: Number(req.params.id) } })
    if (!user) return res.status(404).json({ error: 'User not found' })
    if (normalizeRole(user.role) === ROLES.ADMIN && normalizeRole(req.user?.role) !== ROLES.ADMIN) {
      return res.status(403).json({ error: 'You do not have permission to manage admin accounts' })
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10)
    await prisma.user.updateMany({
      where: { id: user.id },
      // Bump tokenVersion so every outstanding session dies with the old password.
      data: { password: hashedPassword, tokenVersion: { increment: 1 } }
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
    const user = await prisma.user.findFirst({ where: { id: Number(req.params.id) } })
    if (!user) return res.status(404).json({ error: 'User not found' })
    if (normalizeRole(user.role) === ROLES.ADMIN && normalizeRole(req.user?.role) !== ROLES.ADMIN) {
      return res.status(403).json({ error: 'You do not have permission to manage admin accounts' })
    }

    await prisma.user.deleteMany({ where: { id: user.id } })
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
    // Pre-auth: cross-tenant lookup by globally-unique email.
    const user = await platformPrisma.user.findUnique({ where: { email } })
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

    // Pre-auth: the user id comes from the signed reset token itself.
    const hashedPassword = await bcrypt.hash(newPassword, 10)
    await platformPrisma.user.update({
      where: { id: decoded.id },
      // Bump tokenVersion so every outstanding session dies with the old password.
      data: { password: hashedPassword, tokenVersion: { increment: 1 } }
    })

    res.json({ message: 'Password reset successful' })
  } catch (e: any) {
    if (e.message === 'JWT_SECRET is not configured securely') {
      return res.status(500).json({ error: 'Authentication configuration error' })
    }
    if (e.name === 'TokenExpiredError') {
      return res.status(400).json({ error: 'Invalid or expired reset token' })
    }
    res.status(400).json({ error: 'Invalid or expired reset token' })
  }
})

export default router
