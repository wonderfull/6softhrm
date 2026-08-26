import request from 'supertest'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import app from '../src/app'
import prisma, { platformPrisma } from '../src/prismaClient'

async function main() {
  const results: string[] = []
  const check = (name: string, ok: boolean, detail = '') => {
    results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
    if (!ok) process.exitCode = 1
  }

  // 1. health
  const h = await request(app).get('/api/health')
  check('app boots, /api/health', h.status === 200 && h.body.ok === true)

  // 2. deny-by-default: tenant query outside context throws
  let threw = ''
  try { await prisma.employee.findMany() } catch (e: any) { threw = e.message }
  check('no-context query throws TENANT_CONTEXT_MISSING', threw.includes('TENANT_CONTEXT_MISSING'))

  // 3. forbidden op inside context is refused (checked via extension directly)
  //    (runtime check happens in step 6 via real routes)

  // 4. create a gate admin, login, confirm tenant in payload
  const tenant = await platformPrisma.tenant.findUnique({ where: { slug: 'demo' } })
  check('demo tenant exists', !!tenant)
  const hash = await bcrypt.hash('gate-test-pass', 10)
  await platformPrisma.user.upsert({
    where: { email: 'gate-admin@demo.test' },
    update: { password: hash, role: 'ADMIN' },
    create: { tenantId: tenant!.id, email: 'gate-admin@demo.test', password: hash, role: 'ADMIN', name: 'Gate Admin' },
  })
  const login = await request(app).post('/api/auth/login').send({ email: 'gate-admin@demo.test', password: 'gate-test-pass' })
  check('login succeeds', login.status === 200 && !!login.body.token)
  check('login payload carries tenant', login.body?.user?.tenant?.slug === 'demo')
  const decoded: any = jwt.decode(login.body.token)
  check('JWT carries tenantId + tokenVersion', decoded.tenantId === tenant!.id && decoded.tokenVersion === 0)
  const token = `Bearer ${login.body.token}`

  // 5. scoped reads through real routes
  const emps = await request(app).get('/api/employees').set('Authorization', token)
  check('GET /employees returns seeded rows', emps.status === 200 && emps.body.length === 3, `status ${emps.status}, n=${emps.body.length}`)
  const leaves = await request(app).get('/api/leave').set('Authorization', token)
  check('GET /leave returns seeded rows', leaves.status === 200 && leaves.body.length === 3, `status ${leaves.status}, n=${leaves.body.length}`)
  const projects = await request(app).get('/api/projects').set('Authorization', token)
  check('GET /projects returns seeded rows', projects.status === 200 && projects.body.length === 3)

  // 6. mutation round-trip (updateMany codemod path)
  const pending = leaves.body.find((l: any) => l.status === 'PENDING')
  const approve = await request(app).put(`/api/leave/${pending.id}/approve`).set('Authorization', token)
  check('PUT /leave/:id/approve works', approve.status === 200 && approve.body.status === 'APPROVED')

  // 7. legacy token without tenantId is rejected
  const legacy = jwt.sign({ id: 1, email: 'gate-admin@demo.test', role: 'ADMIN' }, process.env.JWT_SECRET as string)
  const rej = await request(app).get('/api/leave').set('Authorization', `Bearer ${legacy}`)
  check('legacy token (no tenantId) → 401', rej.status === 401)

  // 8. cross-tenant isolation: second tenant's admin sees nothing of demo's data
  const t2 = await platformPrisma.tenant.upsert({
    where: { slug: 'gate-two' },
    update: {},
    create: { slug: 'gate-two', name: 'Gate Two Ltd', status: 'ACTIVE' },
  })
  await platformPrisma.user.upsert({
    where: { email: 'gate-admin@two.test' },
    update: { password: hash, role: 'ADMIN', tenantId: t2.id },
    create: { tenantId: t2.id, email: 'gate-admin@two.test', password: hash, role: 'ADMIN' },
  })
  const login2 = await request(app).post('/api/auth/login').send({ email: 'gate-admin@two.test', password: 'gate-test-pass' })
  const token2 = `Bearer ${login2.body.token}`
  const emps2 = await request(app).get('/api/employees').set('Authorization', token2)
  check('tenant B admin sees zero of tenant A employees', emps2.status === 200 && emps2.body.length === 0, `n=${emps2.body.length}`)
  const stealApprove = await request(app).put(`/api/leave/${pending.id}/approve`).set('Authorization', token2)
  check('tenant B cannot approve tenant A leave (404)', stealApprove.status === 404, `status ${stealApprove.status}`)
  const stealEmp = await request(app).get(`/api/documents/${1}/file`).set('Authorization', token2)
  check('tenant B cannot fetch tenant A document (404)', stealEmp.status === 404, `status ${stealEmp.status}`)

  // 8b. storage: uploads land under a tenant-prefixed key; tenant B gets 404
  const upload = await request(app)
    .post('/api/documents/upload')
    .set('Authorization', token)
    .field('employeeId', String((await platformPrisma.employee.findFirst({ where: { tenantId: tenant!.id } }))!.id))
    .field('name', 'Gate upload')
    .attach('file', Buffer.from('%PDF-1.4 gate'), { filename: 'gate.pdf', contentType: 'application/pdf' })
  check('upload succeeds', upload.status === 200, `status ${upload.status}`)
  check(
    'upload key is tenant-prefixed',
    typeof upload.body.path === 'string' && upload.body.path.startsWith(`tenants/${tenant!.id}/documents/`),
    upload.body.path,
  )
  const fileAsB = await request(app)
    .get(`/api/documents/${upload.body.id}/file`)
    .set('Authorization', token2)
  check('tenant B cannot fetch tenant A upload (404)', fileAsB.status === 404, `status ${fileAsB.status}`)
  const fileAsA = await request(app)
    .get(`/api/documents/${upload.body.id}/file`)
    .set('Authorization', token)
  check('tenant A downloads own upload', fileAsA.status === 200, `status ${fileAsA.status}`)

  // 9. suspended tenant blocks login
  await platformPrisma.tenant.update({ where: { id: t2.id }, data: { status: 'SUSPENDED' } })
  const loginSusp = await request(app).post('/api/auth/login').send({ email: 'gate-admin@two.test', password: 'gate-test-pass' })
  check('suspended tenant login → 403', loginSusp.status === 403)
  await platformPrisma.tenant.update({ where: { id: t2.id }, data: { status: 'ACTIVE' } })

  console.log('\n=== P1/P2 GATE ===')
  results.forEach((r) => console.log(r))
  await platformPrisma.$disconnect()
  process.exit(process.exitCode || 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
