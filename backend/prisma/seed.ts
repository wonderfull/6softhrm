import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables from .env file
config({ path: resolve(__dirname, '../.env') })

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function upsertBootstrapUser(role: 'ADMIN' | 'MANAGER', email?: string, password?: string, name?: string) {
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
      email,
      password: passwordHash,
      name: name || `${role} User`,
      role,
    },
  })
}

async function main() {
  console.log('🌱 Seeding database with sample data...')
  const admin = await upsertBootstrapUser(
    'ADMIN',
    process.env.BOOTSTRAP_ADMIN_EMAIL,
    process.env.BOOTSTRAP_ADMIN_PASSWORD,
    process.env.BOOTSTRAP_ADMIN_NAME
  )
  const manager = await upsertBootstrapUser(
    'MANAGER',
    process.env.BOOTSTRAP_MANAGER_EMAIL,
    process.env.BOOTSTRAP_MANAGER_PASSWORD,
    process.env.BOOTSTRAP_MANAGER_NAME
  )

  // Create Employees
  const alice = await prisma.employee.upsert({
    where: { email: 'alice@example.com' },
    update: {},
    create: {
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
    where: { email: 'bob@example.com' },
    update: {},
    create: {
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
    where: { email: 'charlie@example.com' },
    update: {},
    create: {
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
    where: { code: 'AI_QA_01' },
    update: {},
    create: {
      code: 'AI_QA_01',
      name: 'AI QA System',
      description: 'Building an automated QA testing system using AI',
      active: true,
    },
  })

  const proj2 = await prisma.project.upsert({
    where: { code: '02-SAAS' },
    update: {},
    create: {
      code: '02-SAAS',
      name: 'SaaS Platform',
      description: 'Multi-tenant SaaS application',
      active: true,
    },
  })

  const proj3 = await prisma.project.upsert({
    where: { code: 'INTERNAL' },
    update: {},
    create: {
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
        employeeId: alice.id,
        projectId: proj1.id,
        date,
        hours: 6,
        notes: `Working on AI QA features - Day ${i + 1}`,
      },
    })

    await prisma.timesheet.create({
      data: {
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
        employeeId: bob.id,
        projectId: proj2.id,
        date,
        hours: 7,
        notes: 'Product planning and feature specs',
      },
    })

    await prisma.timesheet.create({
      data: {
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
        employeeId: charlie.id,
        projectId: proj1.id,
        date,
        hours: 5,
        notes: 'Architecture review and technical leadership',
      },
    })

    await prisma.timesheet.create({
      data: {
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
      employeeId: alice.id,
      name: 'Employment Contract',
      path: '/uploads/alice-contract.pdf',
    },
  })

  await prisma.document.create({
    data: {
      employeeId: alice.id,
      name: 'Passport Copy',
      path: '/uploads/alice-passport.pdf',
    },
  })

  await prisma.document.create({
    data: {
      employeeId: bob.id,
      name: 'Employment Contract',
      path: '/uploads/bob-contract.pdf',
    },
  })

  await prisma.document.create({
    data: {
      employeeId: charlie.id,
      name: 'Director Agreement',
      path: '/uploads/charlie-director-agreement.pdf',
    },
  })

  console.log('✅ Seed completed successfully!')
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
