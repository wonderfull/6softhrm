import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import fs from 'fs'
import path from 'path'
import prisma from '../../../prismaClient'

export function uniquePrefix(label: string) {
  return `bdd-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function makeToken(payload: Record<string, unknown>) {
  return jwt.sign(payload, process.env.JWT_SECRET || 'test-secret-key')
}

export function authHeader(payload: Record<string, unknown>) {
  return `Bearer ${makeToken(payload)}`
}

export async function createEmployee(prefix: string, overrides: Record<string, any> = {}) {
  return prisma.employee.create({
    data: {
      firstName: overrides.firstName || 'BDD',
      lastName: overrides.lastName || 'Employee',
      email: overrides.email || `${prefix}@example.com`,
      jobTitle: overrides.jobTitle || 'Tester',
      employeeType: overrides.employeeType || 'EMPLOYEE',
      department: overrides.department || 'QA',
      startDate: overrides.startDate || new Date(),
      endDate: overrides.endDate,
      ...overrides,
    },
  })
}

export async function createUser(prefix: string, overrides: Record<string, any> = {}) {
  const password = overrides.password || 'password123'
  const hashedPassword = await bcrypt.hash(password, 10)

  return prisma.user.create({
    data: {
      email: overrides.email || `${prefix}.user@example.com`,
      password: hashedPassword,
      name: overrides.name || prefix,
      role: overrides.role || 'USER',
      employeeId: overrides.employeeId,
    },
  })
}

export async function createProject(prefix: string, overrides: Record<string, any> = {}) {
  return prisma.project.create({
    data: {
      code: overrides.code || prefix.toUpperCase().slice(0, 20),
      name: overrides.name || `${prefix} Project`,
      description: overrides.description || 'BDD test project',
      active: overrides.active ?? true,
    },
  })
}

export async function createLeaveRequest(employeeId: number, overrides: Record<string, any> = {}) {
  return prisma.leaveRequest.create({
    data: {
      employeeId,
      type: overrides.type || 'ANNUAL',
      startDate: overrides.startDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      endDate: overrides.endDate || new Date(Date.now() + 9 * 24 * 60 * 60 * 1000),
      status: overrides.status || 'PENDING',
      reason: overrides.reason || 'BDD leave request',
    },
    include: { employee: true },
  })
}

export async function createSponsorship(employeeId: number, overrides: Record<string, any> = {}) {
  return prisma.sponsorship.create({
    data: {
      employeeId,
      visaType: overrides.visaType || 'Skilled Worker',
      casNumber: overrides.casNumber || `${employeeId}-CAS`,
      sponsorLicenseNumber: overrides.sponsorLicenseNumber || 'BDD-LICENCE',
      startDate: overrides.startDate || new Date(),
      endDate: overrides.endDate,
      complianceNotes: overrides.complianceNotes || 'BDD sponsorship',
      active: overrides.active ?? true,
    },
    include: { employee: true },
  })
}

export async function createTimesheet(employeeId: number, projectId: number | null, overrides: Record<string, any> = {}) {
  return prisma.timesheet.create({
    data: {
      employeeId,
      projectId,
      date: overrides.date || new Date(),
      hours: overrides.hours || 8,
      notes: overrides.notes || 'BDD timesheet',
    },
  })
}

export async function createDocument(employeeId: number, prefix: string, overrides: Record<string, any> = {}) {
  return prisma.document.create({
    data: {
      employeeId,
      name: overrides.name || `${prefix}-document.pdf`,
      path: overrides.path || `/uploads/${prefix}-document.pdf`,
      type: overrides.type || 'CONTRACT',
      expiryDate: overrides.expiryDate,
    },
    include: { employee: true },
  })
}

export function ensureUploadFile(prefix: string, filename = `${prefix}.pdf`, contents = 'bdd-test-file') {
  const uploadsDir = path.join(process.cwd(), 'uploads')
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true })
  }

  const absolutePath = path.join(uploadsDir, filename)
  fs.writeFileSync(absolutePath, contents)

  return {
    absolutePath,
    publicPath: `/uploads/${filename}`,
  }
}

export async function cleanupFixturePrefix(prefix: string) {
  const employees = await prisma.employee.findMany({
    where: { email: { contains: prefix } },
    select: { id: true },
  })
  const employeeIds = employees.map((employee) => employee.id)

  if (employeeIds.length > 0) {
    await prisma.dataConsent.deleteMany({ where: { employeeId: { in: employeeIds } } })
    await prisma.document.deleteMany({ where: { employeeId: { in: employeeIds } } })
    await prisma.leaveRequest.deleteMany({ where: { employeeId: { in: employeeIds } } })
    await prisma.timesheet.deleteMany({ where: { employeeId: { in: employeeIds } } })
    await prisma.sponsorship.deleteMany({ where: { employeeId: { in: employeeIds } } })
  }

  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { userEmail: { contains: prefix } },
        { details: { contains: prefix } },
      ],
    },
  })

  await prisma.user.deleteMany({ where: { email: { contains: prefix } } })
  await prisma.employee.deleteMany({ where: { email: { contains: prefix } } })
  await prisma.project.deleteMany({
    where: {
      OR: [
        { code: { contains: prefix.toUpperCase().slice(0, 10) } },
        { name: { contains: prefix } },
      ],
    },
  })

  const uploadsDir = path.join(process.cwd(), 'uploads')
  if (fs.existsSync(uploadsDir)) {
    for (const file of fs.readdirSync(uploadsDir)) {
      if (file.includes(prefix)) {
        fs.unlinkSync(path.join(uploadsDir, file))
      }
    }
  }
}
