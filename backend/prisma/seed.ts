import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables from .env file
config({ path: resolve(__dirname, '../.env') })

import bcrypt from 'bcryptjs'
import { platformPrisma as prisma } from '../src/prismaClient'

// The seed uses the platform (unscoped) client deliberately: it runs outside
// any request, and every row it writes carries an explicit tenantId. Field
// encryption still applies, so seeded NI numbers are not stored in plaintext.

async function upsertBootstrapUser(
  tenantId: number,
  role: 'ADMIN' | 'MANAGER',
  email?: string,
  password?: string,
  name?: string,
) {
  if (!email || !password) {
    return null
  }

  const passwordHash = await bcrypt.hash(password, 10)

  return prisma.user.upsert({
    where: { email },
    update: {
      password: passwordHash,
      name: name || undefined,
      role,
    },
    create: {
      tenantId,
      email,
      password: passwordHash,
      name: name || `${role} User`,
      role,
    },
  })
}

async function main() {
  console.log('🌱 Seeding database with sample data...')

  // Tenant zero — the demo company everything below belongs to.
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    update: {},
    create: {
      slug: 'demo',
      name: 'Demo Company Ltd',
      status: 'ACTIVE',
      plan: 'CORE_PLUS_COMPLIANCE',
      features: { compliance: true },
      settings: { create: {} },
    },
  })
  const tenantId = tenant.id
  console.log(`Created tenant ${tenant.slug} (#${tenantId})`)

  // Platform operator (us) — separate table, separate login.
  if (process.env.PLATFORM_ADMIN_EMAIL && process.env.PLATFORM_ADMIN_PASSWORD) {
    const platformHash = await bcrypt.hash(process.env.PLATFORM_ADMIN_PASSWORD, 10)
    await prisma.platformAdmin.upsert({
      where: { email: process.env.PLATFORM_ADMIN_EMAIL },
      update: { password: platformHash },
      create: {
        email: process.env.PLATFORM_ADMIN_EMAIL,
        password: platformHash,
        name: process.env.PLATFORM_ADMIN_NAME || 'Platform Admin',
      },
    })
    console.log(`Platform admin: ${process.env.PLATFORM_ADMIN_EMAIL}`)
  }

  const admin = await upsertBootstrapUser(
    tenantId,
    'ADMIN',
    process.env.BOOTSTRAP_ADMIN_EMAIL,
    process.env.BOOTSTRAP_ADMIN_PASSWORD,
    process.env.BOOTSTRAP_ADMIN_NAME
  )
  const manager = await upsertBootstrapUser(
    tenantId,
    'MANAGER',
    process.env.BOOTSTRAP_MANAGER_EMAIL,
    process.env.BOOTSTRAP_MANAGER_PASSWORD,
    process.env.BOOTSTRAP_MANAGER_NAME
  )

  // Create Employees
  const alice = await prisma.employee.upsert({
    where: { tenantId_email: { tenantId, email: 'alice@example.com' } },
    update: {},
    create: {
      tenantId,
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'alice@example.com',
      phoneNumber: '07700 900001',
      niNumber: 'QQ123456C',
      jobTitle: 'Software Engineer',
      employeeType: 'EMPLOYEE',
      department: 'Engineering',
      startDate: new Date('2024-01-02'),
    },
  })

  const bob = await prisma.employee.upsert({
    where: { tenantId_email: { tenantId, email: 'bob@example.com' } },
    update: {},
    create: {
      tenantId,
      firstName: 'Bob',
      lastName: 'Johnson',
      email: 'bob@example.com',
      phoneNumber: '07700 900002',
      niNumber: 'AB987654D',
      jobTitle: 'Product Manager',
      employeeType: 'EMPLOYEE',
      department: 'Product',
      startDate: new Date('2023-06-15'),
    },
  })
  console.log('Created Bob:', bob.id)

  const charlie = await prisma.employee.upsert({
    where: { tenantId_email: { tenantId, email: 'charlie@example.com' } },
    update: {},
    create: {
      tenantId,
      firstName: 'Charlie',
      lastName: 'Davis',
      email: 'charlie@example.com',
      phoneNumber: '07700 900003',
      niNumber: 'CD456789E',
      jobTitle: 'Senior Developer',
      employeeType: 'DIRECTOR',
      department: 'Engineering',
      startDate: new Date('2022-03-10'),
    },
  })

  // Create Projects
  const proj1 = await prisma.project.upsert({
    where: { tenantId_code: { tenantId, code: 'AI_QA_01' } },
    update: {},
    create: {
      tenantId,
      code: 'AI_QA_01',
      name: 'AI QA System',
      description: 'Building an automated QA testing system using AI',
      active: true,
    },
  })

  const proj2 = await prisma.project.upsert({
    where: { tenantId_code: { tenantId, code: '02-SAAS' } },
    update: {},
    create: {
      tenantId,
      code: '02-SAAS',
      name: 'SaaS Platform',
      description: 'Multi-tenant SaaS application',
      active: true,
    },
  })

  const proj3 = await prisma.project.upsert({
    where: { tenantId_code: { tenantId, code: 'INTERNAL' } },
    update: {},
    create: {
      tenantId,
      code: 'INTERNAL',
      name: 'Internal Operations',
      description: 'Internal company operations and admin',
      active: true,
    },
  })

  // Create Sponsorships
  await prisma.sponsorship.upsert({
    where: { id: 1 },
    update: {},
    create: {
      tenantId,
      employeeId: alice.id,
      visaType: 'Skilled Worker',
      casNumber: 'CAS123456789',
      sponsorLicenseNumber: 'LIC-UK-0001',
      startDate: new Date('2024-01-02'),
      endDate: new Date('2026-01-01'),
      complianceNotes: 'Initial sponsorship record - all documentation complete',
      active: true,
    },
  })

  await prisma.sponsorship.upsert({
    where: { id: 2 },
    update: {},
    create: {
      tenantId,
      employeeId: charlie.id,
      visaType: 'Skilled Worker',
      casNumber: 'CAS987654321',
      sponsorLicenseNumber: 'LIC-UK-0001',
      startDate: new Date('2022-03-10'),
      endDate: new Date('2027-03-09'),
      complianceNotes: 'Senior director visa - extended term',
      active: true,
    },
  })

  // Create Timesheets
  const today = new Date()
  const thisWeek = new Date(today)
  thisWeek.setDate(today.getDate() - today.getDay() + 1) // Monday

  for (let i = 0; i < 5; i++) {
    const date = new Date(thisWeek)
    date.setDate(thisWeek.getDate() + i)

    // Alice's timesheets
    await prisma.timesheet.create({
      data: {
        tenantId,
        employeeId: alice.id,
        projectId: proj1.id,
        date,
        hours: 6,
        notes: `Working on AI QA features - Day ${i + 1}`,
      },
    })

    await prisma.timesheet.create({
      data: {
        tenantId,
        employeeId: alice.id,
        projectId: proj3.id,
        date,
        hours: 2,
        notes: 'Team meetings and code review',
      },
    })

    // Bob's timesheets
    await prisma.timesheet.create({
      data: {
        tenantId,
        employeeId: bob.id,
        projectId: proj2.id,
        date,
        hours: 7,
        notes: 'Product planning and feature specs',
      },
    })

    await prisma.timesheet.create({
      data: {
        tenantId,
        employeeId: bob.id,
        projectId: proj3.id,
        date,
        hours: 1,
        notes: 'Admin and 1-on-1s',
      },
    })

    // Charlie's timesheets
    await prisma.timesheet.create({
      data: {
        tenantId,
        employeeId: charlie.id,
        projectId: proj1.id,
        date,
        hours: 5,
        notes: 'Architecture review and technical leadership',
      },
    })

    await prisma.timesheet.create({
      data: {
        tenantId,
        employeeId: charlie.id,
        projectId: proj2.id,
        date,
        hours: 3,
        notes: 'Cross-project technical consultation',
      },
    })
  }

  // Create Leave Requests
  const nextWeek = new Date(today)
  nextWeek.setDate(today.getDate() + 7)
  const weekAfter = new Date(nextWeek)
  weekAfter.setDate(nextWeek.getDate() + 7)

  await prisma.leaveRequest.create({
    data: {
      tenantId,
      employeeId: alice.id,
      type: 'Annual Leave',
      startDate: nextWeek,
      endDate: new Date(nextWeek.getTime() + 2 * 24 * 60 * 60 * 1000),
      status: 'PENDING',
      reason: 'Family holiday',
    },
  })

  await prisma.leaveRequest.create({
    data: {
      tenantId,
      employeeId: bob.id,
      type: 'Sick Leave',
      startDate: new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000),
      endDate: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000),
      status: 'APPROVED',
      reason: 'Medical appointment',
    },
  })

  await prisma.leaveRequest.create({
    data: {
      tenantId,
      employeeId: charlie.id,
      type: 'Annual Leave',
      startDate: weekAfter,
      endDate: new Date(weekAfter.getTime() + 5 * 24 * 60 * 60 * 1000),
      status: 'PENDING',
      reason: 'Summer vacation',
    },
  })

  // Create Document records (metadata only - no actual files)
  await prisma.document.create({
    data: {
      tenantId,
      employeeId: alice.id,
      name: 'Employment Contract',
      path: '/uploads/alice-contract.pdf',
    },
  })

  await prisma.document.create({
    data: {
      tenantId,
      employeeId: alice.id,
      name: 'Passport Copy',
      path: '/uploads/alice-passport.pdf',
    },
  })

  await prisma.document.create({
    data: {
      tenantId,
      employeeId: bob.id,
      name: 'Employment Contract',
      path: '/uploads/bob-contract.pdf',
    },
  })

  await prisma.document.create({
    data: {
      tenantId,
      employeeId: charlie.id,
      name: 'Director Agreement',
      path: '/uploads/charlie-director-agreement.pdf',
    },
  })

  console.log('✅ Seed completed successfully!')
  console.log(`   - Tenant: ${tenant.slug} (#${tenantId})`)
  if (admin || manager) {
    console.log(`   - Bootstrap Users: ${[admin?.email, manager?.email].filter(Boolean).join(', ')}`)
  } else {
    console.log('   - Bootstrap Users: none created (set BOOTSTRAP_ADMIN_EMAIL/BOOTSTRAP_ADMIN_PASSWORD to create a real admin)')
  }
  console.log(`   - Employees: ${alice.id}, ${bob.id}, ${charlie.id}`)
  console.log(`   - Projects: ${proj1.id}, ${proj2.id}, ${proj3.id}`)
  console.log(`   - Timesheets: 90 entries created`)
  console.log(`   - Leave Requests: 3 created`)
  console.log(`   - Documents: 4 created`)
  console.log(`   - Sponsorships: 2 created`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
