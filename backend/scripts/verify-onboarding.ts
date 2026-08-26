// P6 gate: onboard a fake customer end to end through the real HTTP stack —
// create tenant, import 50 employees from CSV, redeem the admin setup link,
// log in under their branding, request and approve leave, upload a document.
import request from 'supertest'
import bcrypt from 'bcryptjs'
import app from '../src/app'
import { platformPrisma } from '../src/prismaClient'

async function main() {
  const results: string[] = []
  const check = (name: string, ok: boolean, detail = '') => {
    results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
    if (!ok) process.exitCode = 1
  }

  // platform admin
  const hash = await bcrypt.hash('onboarding-gate-pass', 10)
  await platformPrisma.platformAdmin.upsert({
    where: { email: 'gate-operator@onsidehr.test' },
    update: { password: hash },
    create: { email: 'gate-operator@onsidehr.test', password: hash },
  })
  const platformLogin = await request(app)
    .post('/api/platform/auth/login')
    .send({ email: 'gate-operator@onsidehr.test', password: 'onboarding-gate-pass' })
  const platformToken = `Bearer ${platformLogin.body.token}`
  check('platform login', platformLogin.status === 200)

  // fresh tenant
  const old = await platformPrisma.tenant.findUnique({ where: { slug: 'gate-onboarding' } })
  if (old) {
    await platformPrisma.user.deleteMany({ where: { tenantId: old.id } })
    await platformPrisma.tenant.delete({ where: { id: old.id } })
  }
  const created = await request(app)
    .post('/api/platform/tenants')
    .set('Authorization', platformToken)
    .send({
      name: 'Gate Onboarding Ltd',
      slug: 'gate-onboarding',
      plan: 'CORE_PLUS_COMPLIANCE',
      seatLimit: 60,
      adminEmail: 'hr@gate-onboarding.test',
      adminName: 'Gate HR',
      logoUrl: 'https://example.com/logo.png',
    })
  check('tenant created with setup link', created.status === 200 && !!created.body.setupLink)

  // redeem setup link
  const setupToken = created.body.setupLink.split('token=')[1]
  const reset = await request(app)
    .post('/api/auth/reset-password')
    .send({ token: setupToken, newPassword: 'Onboarding-Pass-1' })
  check('setup link redeemed', reset.status === 200)

  const login = await request(app)
    .post('/api/auth/login')
    .send({ email: 'hr@gate-onboarding.test', password: 'Onboarding-Pass-1' })
  check('admin logs in', login.status === 200 && !!login.body.token)
  check('login carries tenant branding', login.body.user?.tenant?.name === 'Gate Onboarding Ltd')
  const token = `Bearer ${login.body.token}`

  // 50-employee CSV import: dry run then commit
  const rows = Array.from({ length: 50 }, (_, i) =>
    `First${i},Last${i},person${i}@gate-onboarding.test,Care Assistant,2026-0${(i % 8) + 1}-15`)
  const csv = Buffer.from(['First Name,Last Name,Email,Job Title,Start Date', ...rows].join('\n'))

  const dry = await request(app)
    .post('/api/employees/import?dryRun=true')
    .set('Authorization', token)
    .attach('file', csv, 'staff.csv')
  check('dry run: 50 creates, 0 errors', dry.status === 200 && dry.body.summary.creates === 50 && dry.body.summary.errors === 0,
    JSON.stringify(dry.body.summary ?? dry.body))

  const imp = await request(app)
    .post('/api/employees/import')
    .set('Authorization', token)
    .attach('file', csv, 'staff.csv')
  check('import: 50 created', imp.status === 200 && imp.body.summary.created === 50, JSON.stringify(imp.body.summary ?? imp.body))

  const employees = await request(app).get('/api/employees').set('Authorization', token)
  check('employee list shows 50', employees.status === 200 && employees.body.length === 50, `n=${employees.body.length}`)

  // seat limit bites at 60
  const more = Array.from({ length: 11 }, (_, i) =>
    `Extra${i},Person${i},extra${i}@gate-onboarding.test,Care Assistant,2026-01-15`)
  const overCsv = Buffer.from(['First Name,Last Name,Email,Job Title,Start Date', ...more].join('\n'))
  const over = await request(app)
    .post('/api/employees/import')
    .set('Authorization', token)
    .attach('file', overCsv, 'more.csv')
  check('seat limit blocks import past 60', over.status === 402 && over.body.code === 'SEAT_LIMIT_REACHED', `status ${over.status}`)

  // leave request + approval
  const emp = employees.body[0]
  const leave = await request(app)
    .post('/api/leave')
    .set('Authorization', token)
    .send({ employeeId: emp.id, type: 'Annual Leave', startDate: '2026-09-07', endDate: '2026-09-09', reason: 'Gate' })
  check('leave request created', leave.status === 200 && leave.body.status === 'PENDING')
  const approve = await request(app)
    .put(`/api/leave/${leave.body.id}/approve`)
    .set('Authorization', token)
  check('leave approved', approve.status === 200 && approve.body.status === 'APPROVED')

  // document upload
  const upload = await request(app)
    .post('/api/documents/upload')
    .set('Authorization', token)
    .field('employeeId', String(emp.id))
    .field('name', 'Employment contract')
    .attach('file', Buffer.from('%PDF-1.4 onboarding'), { filename: 'contract.pdf', contentType: 'application/pdf' })
  check('document uploaded under tenant key', upload.status === 200 && String(upload.body.path).includes('/documents/'))

  // compliance module reachable on this plan
  const sponsorships = await request(app).get('/api/sponsorships').set('Authorization', token)
  check('compliance module reachable (plan includes it)', sponsorships.status === 200)

  // and gated off when the feature is disabled
  const t = await platformPrisma.tenant.findUnique({ where: { slug: 'gate-onboarding' } })
  await platformPrisma.tenant.update({ where: { id: t!.id }, data: { features: { compliance: false } } })
  const gated = await request(app).get('/api/sponsorships').set('Authorization', token)
  check('compliance gated when feature off (403)', gated.status === 403 && gated.body.error === 'FEATURE_NOT_AVAILABLE', `status ${gated.status}`)
  await platformPrisma.tenant.update({ where: { id: t!.id }, data: { features: { compliance: true } } })

  console.log('\n=== P6 ONBOARDING GATE ===')
  results.forEach((r) => console.log(r))
  await platformPrisma.$disconnect()
  process.exit(process.exitCode || 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
