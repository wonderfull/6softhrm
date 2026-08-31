import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { platformPrisma } from '../prismaClient'
import { getJwtSecret } from '../lib/authConfig'
import { requirePlatformAdmin } from '../middleware/platformAuth'
import { createAuditLog } from '../middleware/audit'
import { AuthRequest } from '../middleware/auth'
import { loginThrottle } from '../lib/loginThrottle'
import { throttleLoginByAccount } from '../middleware/loginThrottle'

const PLATFORM_THROTTLE_PREFIX = 'platform:'

const router = Router()

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/
const TENANT_STATUSES = new Set(['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED'])

function tenantSummary(t: any) {
  return {
    id: t.id,
    slug: t.slug,
    name: t.name,
    status: t.status,
    plan: t.plan,
    seatLimit: t.seatLimit,
    features: t.features,
    trialEndsAt: t.trialEndsAt,
    deletedAt: t.deletedAt,
    createdAt: t.createdAt,
    userCount: t._count?.users,
    employeeCount: t._count?.employees,
  }
}

// --- Platform authentication -----------------------------------------------

// The platform console can reach every tenant, so it is the highest-value
// credential in the system and gets the same per-account throttle as tenant
// login. The prefix keeps its counters separate from a tenant user's.
router.post('/auth/login', throttleLoginByAccount(PLATFORM_THROTTLE_PREFIX), async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'email and password required' })

  const admin = await platformPrisma.platformAdmin.findUnique({ where: { email } })
  if (!admin || !(await bcrypt.compare(password, admin.password))) {
    await createAuditLog(null, email, 'PLATFORM_LOGIN_FAILED', 'PlatformAdmin', null, null, req, null)
    const { locked, failures, retryAfterMs } = loginThrottle.registerFailure(
      `${PLATFORM_THROTTLE_PREFIX}${email}`,
    )
    if (locked) {
      await createAuditLog(
        null,
        email,
        'PLATFORM_LOGIN_LOCKED_OUT',
        'PlatformAdmin',
        null,
        `${failures} failed attempts; locked for ${Math.ceil(retryAfterMs / 60000)}m`,
        req,
        null,
      )
    }
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  loginThrottle.reset(`${PLATFORM_THROTTLE_PREFIX}${email}`)

  try {
    const secret = getJwtSecret()
    const token = jwt.sign(
      { kind: 'platform', platformAdminId: admin.id, email: admin.email },
      secret,
      { expiresIn: '4h' },
    )
    await createAuditLog(admin.id, email, 'PLATFORM_LOGIN_SUCCESS', 'PlatformAdmin', admin.id, null, req, null)
    res.json({ token, admin: { id: admin.id, email: admin.email, name: admin.name } })
  } catch {
    res.status(500).json({ error: 'Authentication configuration error' })
  }
})

// --- Tenant management ------------------------------------------------------

router.get('/tenants', requirePlatformAdmin, async (req, res) => {
  const tenants = await platformPrisma.tenant.findMany({
    include: { _count: { select: { users: true, employees: true } } },
    orderBy: { createdAt: 'desc' },
  })
  res.json(tenants.map(tenantSummary))
})

router.post('/tenants', requirePlatformAdmin, async (req: AuthRequest, res) => {
  const { name, slug, plan, seatLimit, trialDays, features, adminEmail, adminName } = req.body
  if (!name || !slug) return res.status(400).json({ error: 'name and slug required' })
  if (!SLUG_RE.test(slug)) {
    return res.status(400).json({ error: 'slug must be lowercase letters, digits and hyphens (3-40 chars)' })
  }
  if (!adminEmail) return res.status(400).json({ error: 'adminEmail required — every tenant needs a first admin' })

  try {
    const existingSlug = await platformPrisma.tenant.findUnique({ where: { slug } })
    if (existingSlug) return res.status(409).json({ error: 'A tenant with this slug already exists' })
    const existingUser = await platformPrisma.user.findUnique({ where: { email: adminEmail } })
    if (existingUser) return res.status(409).json({ error: 'A user with this email already exists' })

    const trialEndsAt = trialDays
      ? new Date(Date.now() + Number(trialDays) * 24 * 60 * 60 * 1000)
      : null

    const tenant = await platformPrisma.tenant.create({
      data: {
        name,
        slug,
        status: trialEndsAt ? 'TRIAL' : 'ACTIVE',
        plan: plan || 'CORE',
        seatLimit: seatLimit ? Number(seatLimit) : null,
        features: features ?? { compliance: plan === 'CORE_PLUS_COMPLIANCE' },
        trialEndsAt,
        settings: { create: {} },
      },
    })

    // First admin: random unusable password + a one-hour setup link.
    const randomPassword = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10)
    const adminUser = await platformPrisma.user.create({
      data: {
        tenantId: tenant.id,
        email: adminEmail,
        name: adminName || null,
        password: randomPassword,
        role: 'ADMIN',
      },
    })
    const secret = getJwtSecret()
    const setupToken = jwt.sign(
      { id: adminUser.id, email: adminUser.email, type: 'password-reset' },
      secret,
      { expiresIn: '7d' },
    )
    const setupLink = `${process.env.FRONTEND_URL || 'http://localhost:5174'}/reset-password?token=${setupToken}`

    await createAuditLog(
      req.user?.platformAdminId ?? null, req.user?.email ?? null,
      'TENANT_CREATED', 'Tenant', tenant.id,
      JSON.stringify({ slug, adminEmail }), req, tenant.id,
    )

    res.json({ tenant: tenantSummary(tenant), admin: { id: adminUser.id, email: adminUser.email }, setupLink })
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

router.put('/tenants/:id', requirePlatformAdmin, async (req: AuthRequest, res) => {
  const id = Number(req.params.id)
  const { name, status, plan, seatLimit, features, trialEndsAt, logoUrl, primaryColor } = req.body
  if (status !== undefined && !TENANT_STATUSES.has(status)) {
    return res.status(400).json({ error: 'invalid status' })
  }
  try {
    const data: any = {}
    if (name !== undefined) data.name = name
    if (status !== undefined) {
      data.status = status
      data.deletedAt = status === 'CANCELLED' ? new Date() : null
    }
    if (plan !== undefined) data.plan = plan
    if (seatLimit !== undefined) data.seatLimit = seatLimit === null ? null : Number(seatLimit)
    if (features !== undefined) data.features = features
    if (trialEndsAt !== undefined) data.trialEndsAt = trialEndsAt ? new Date(trialEndsAt) : null
    if (logoUrl !== undefined) data.logoUrl = logoUrl || null
    if (primaryColor !== undefined) data.primaryColor = primaryColor || null

    const tenant = await platformPrisma.tenant.update({ where: { id }, data })
    await createAuditLog(
      req.user?.platformAdminId ?? null, req.user?.email ?? null,
      'TENANT_UPDATED', 'Tenant', id, JSON.stringify(data), req, id,
    )
    res.json(tenantSummary(tenant))
  } catch (e: any) {
    res.status(404).json({ error: 'Tenant not found' })
  }
})

// Impersonation: mint a short-lived tenant token for a named (or the first
// ADMIN) user. Every action taken under it is audited into the tenant's own
// log flagged impersonatedBy — the customer is entitled to know when the
// processor accessed their data.
router.post('/tenants/:id/impersonate', requirePlatformAdmin, async (req: AuthRequest, res) => {
  const id = Number(req.params.id)
  const { userId } = req.body
  const tenant = await platformPrisma.tenant.findUnique({ where: { id } })
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' })
  if (tenant.status === 'CANCELLED' || tenant.deletedAt) {
    return res.status(403).json({ error: 'ACCOUNT_CLOSED' })
  }

  const user = userId
    ? await platformPrisma.user.findFirst({ where: { id: Number(userId), tenantId: id } })
    : await platformPrisma.user.findFirst({ where: { tenantId: id, role: 'ADMIN' }, orderBy: { id: 'asc' } })
  if (!user) return res.status(404).json({ error: 'No user to impersonate in this tenant' })

  const secret = getJwtSecret()
  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      employeeId: user.employeeId,
      tenantId: user.tenantId,
      tokenVersion: user.tokenVersion,
      impersonatedBy: req.user?.platformAdminId,
    },
    secret,
    { expiresIn: '15m' },
  )

  await createAuditLog(
    req.user?.platformAdminId ?? null, req.user?.email ?? null,
    'IMPERSONATION_STARTED', 'User', user.id,
    JSON.stringify({ tenantId: id, asUser: user.email }), req, id,
  )

  res.json({ token, user: { id: user.id, email: user.email, role: user.role }, expiresInMinutes: 15 })
})

export default router
