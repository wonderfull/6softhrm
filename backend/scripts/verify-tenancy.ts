// Tenant-isolation gate. Self-seeding and idempotent: it builds its own two
// tenants and fixtures on every run, so it can be re-run any number of times
// and does not depend on (or disturb) the demo seed data.
//   npm run verify:tenancy
import request from 'supertest'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import app from '../src/app'
import prisma, { platformPrisma } from '../src/prismaClient'
import { runWithTenant } from '../src/lib/tenantContext'

const PASSWORD = 'gate-test-pass'

async function resetTenant(slug: string, name: string) {
  const existing = await platformPrisma.tenant.findUnique({ where: { slug } })
  if (existing) {
    // Children first — FKs have no cascade from every direction.
    await platformPrisma.leaveRequest.deleteMany({ where: { tenantId: existing.id } })
    await platformPrisma.timesheet.deleteMany({ where: { tenantId: existing.id } })
    await platformPrisma.document.deleteMany({ where: { tenantId: existing.id } })
    await platformPrisma.sponsorship.deleteMany({ where: { tenantId: existing.id } })
    await platformPrisma.dataConsent.deleteMany({ where: { tenantId: existing.id } })
    await platformPrisma.user.deleteMany({ where: { tenantId: existing.id } })
    await platformPrisma.employee.deleteMany({ where: { tenantId: existing.id } })
    await platformPrisma.project.deleteMany({ where: { tenantId: existing.id } })
    await platformPrisma.auditLog.deleteMany({ where: { tenantId: existing.id } })
    return existing
  }
  return platformPrisma.tenant.create({
    data: { slug, name, status: 'ACTIVE', plan: 'CORE_PLUS_COMPLIANCE', features: { compliance: true } },
  })
}

async function seedTenant(slug: string, name: string) {
  const tenant = await resetTenant(slug, name)
  const hash = await bcrypt.hash(PASSWORD, 10)
  await platformPrisma.user.create({
    data: { tenantId: tenant.id, email: `admin@${slug}.gate.test`, password: hash, role: 'ADMIN', name: `${name} Admin` },
  })
  await runWithTenant({ tenantId: tenant.id }, async () => {
    for (const n of [1, 2, 3]) {
      const employee = await prisma.employee.create({
        data: {
          tenantId: tenant.id,
          firstName: `Person${n}`,
          lastName: name,
          email: `person${n}@${slug}.gate.test`,
          jobTitle: 'Tester',
          employeeType: 'EMPLOYEE',
        },
      })
      await prisma.leaveRequest.create({
        data: {
          tenantId: tenant.id,
          employeeId: employee.id,
          type: 'Annual Leave',
          startDate: new Date('2026-09-01'),
          endDate: new Date('2026-09-03'),
          status: 'PENDING',
        },
      })
    }
    await prisma.project.create({
      data: { tenantId: tenant.id, code: 'GATE', name: 'Gate project' },
    })
  })
  return tenant
}

async function main() {
  const results: string[] = []
  const check = (name: string, ok: boolean, detail = '') => {
    results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
    if (!ok) process.exitCode = 1
  }

  // 1. health
  const h = await request(app).get('/api/health')
  check('app boots, /api/health', h.status === 200 && h.body.ok === true)

  // 2. deny-by-default: tenant query outside any context throws
  let threw = ''
  try { await prisma.employee.findMany() } catch (e: any) { threw = e.message }
  check('no-context query throws TENANT_CONTEXT_MISSING', threw.includes('TENANT_CONTEXT_MISSING'))

  // 3. unique-where ops are refused even inside a context
  let opThrew = ''
  const seedTenantA = await seedTenant('gate-one', 'Gate One')
  const tenantB = await seedTenant('gate-two', 'Gate Two')
  await runWithTenant({ tenantId: seedTenantA.id }, async () => {
    try {
      await (prisma as any).employee.findUnique({ where: { id: 1 } })
    } catch (e: any) { opThrew = e.message }
  })
  check('findUnique on a tenant model is refused', opThrew.includes('TENANT_UNSAFE_OPERATION'), opThrew.slice(0, 60))

  // 4. login carries the tenant
  const login = await request(app).post('/api/auth/login').send({ email: 'admin@gate-one.gate.test', password: PASSWORD })
  check('login succeeds', login.status === 200 && !!login.body.token)
  check('login payload carries tenant', login.body?.user?.tenant?.slug === 'gate-one')
  const decoded: any = jwt.decode(login.body.token)
  check('JWT carries tenantId + tokenVersion', decoded.tenantId === seedTenantA.id && decoded.tokenVersion === 0)
  const token = `Bearer ${login.body.token}`

  const loginB = await request(app).post('/api/auth/login').send({ email: 'admin@gate-two.gate.test', password: PASSWORD })
  const token2 = `Bearer ${loginB.body.token}`

  // 5. scoped reads see only this tenant's rows
  const emps = await request(app).get('/api/employees').set('Authorization', token)
  check('GET /employees is tenant-scoped', emps.status === 200 && emps.body.length === 3, `status ${emps.status}, n=${emps.body.length}`)
  const leaves = await request(app).get('/api/leave').set('Authorization', token)
  check('GET /leave is tenant-scoped', leaves.status === 200 && leaves.body.length === 3, `status ${leaves.status}, n=${leaves.body.length}`)
  const projects = await request(app).get('/api/projects').set('Authorization', token)
  check('GET /projects is tenant-scoped', projects.status === 200 && projects.body.length === 1, `n=${projects.body.length}`)

  // 6. mutation round-trip through the updateMany codemod path
  const pending = leaves.body.find((l: any) => l.status === 'PENDING')
  const approve = await request(app).put(`/api/leave/${pending.id}/approve`).set('Authorization', token)
  check('PUT /leave/:id/approve works', approve.status === 200 && approve.body.status === 'APPROVED')

  // 7. legacy token without tenantId is rejected
  const legacy = jwt.sign({ email: 'admin@gate-one.gate.test', role: 'ADMIN' }, process.env.JWT_SECRET as string)
  const rej = await request(app).get('/api/leave').set('Authorization', `Bearer ${legacy}`)
  check('legacy token (no tenantId) → 401', rej.status === 401)

  // 8. cross-tenant isolation
  const empsB = await request(app).get('/api/employees').set('Authorization', token2)
  const tenantAEmployeeIds = new Set(emps.body.map((e: any) => e.id))
  check(
    'tenant B sees none of tenant A employees',
    empsB.status === 200 && empsB.body.every((e: any) => !tenantAEmployeeIds.has(e.id)),
    `n=${empsB.body.length}`,
  )
  const stealApprove = await request(app).put(`/api/leave/${pending.id}/approve`).set('Authorization', token2)
  check('tenant B cannot approve tenant A leave (404)', stealApprove.status === 404, `status ${stealApprove.status}`)

  // 9. storage: uploads land under a tenant-prefixed key; tenant B is refused
  const upload = await request(app)
    .post('/api/documents/upload')
    .set('Authorization', token)
    .field('employeeId', String(emps.body[0].id))
    .field('name', 'Gate upload')
    .attach('file', Buffer.from('%PDF-1.4 gate'), { filename: 'gate.pdf', contentType: 'application/pdf' })
  check('upload succeeds', upload.status === 200, `status ${upload.status}`)
  check(
    'upload key is tenant-prefixed',
    typeof upload.body.path === 'string' && upload.body.path.startsWith(`tenants/${seedTenantA.id}/documents/`),
    upload.body.path,
  )
  const fileAsB = await request(app).get(`/api/documents/${upload.body.id}/file`).set('Authorization', token2)
  check('tenant B cannot fetch tenant A upload (404)', fileAsB.status === 404, `status ${fileAsB.status}`)
  const fileAsA = await request(app).get(`/api/documents/${upload.body.id}/file`).set('Authorization', token)
  check('tenant A downloads own upload', fileAsA.status === 200, `status ${fileAsA.status}`)

  // 10. tenant lifecycle: suspension blocks login AND live sessions
  await platformPrisma.tenant.update({ where: { id: tenantB.id }, data: { status: 'SUSPENDED' } })
  const loginSusp = await request(app).post('/api/auth/login').send({ email: 'admin@gate-two.gate.test', password: PASSWORD })
  check('suspended tenant login → 403', loginSusp.status === 403, `status ${loginSusp.status}`)
  const liveSusp = await request(app).get('/api/employees').set('Authorization', token2)
  check('suspended tenant live session → 403', liveSusp.status === 403, `status ${liveSusp.status}`)
  await platformPrisma.tenant.update({ where: { id: tenantB.id }, data: { status: 'ACTIVE' } })

  console.log('\n=== TENANCY GATE ===')
  results.forEach((r) => console.log(r))
  console.log(results.some((r) => r.startsWith('FAIL')) ? '\nRESULT: FAIL' : '\nRESULT: PASS')
  await platformPrisma.$disconnect()
  process.exit(process.exitCode || 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
