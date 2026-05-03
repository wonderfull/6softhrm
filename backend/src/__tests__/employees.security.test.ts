import { afterAll, beforeAll, describe, expect, it } from '@jest/globals'
import express from 'express'
import request from 'supertest'
import authRouter from '../routes/auth'
import employeesRouter from '../routes/employees'
import prisma from '../prismaClient'
import {
  authHeader,
  cleanupFixturePrefix,
  createEmployee,
  createUser,
  uniquePrefix,
} from './bdd/helpers/fixtures'

const app = express()
app.use(express.json())
app.use('/api/auth', authRouter)
app.use('/api/employees', employeesRouter)

describe('Employees authorization', () => {
  let employeeId: number

  beforeAll(async () => {
    await prisma.document.deleteMany({})
    await prisma.timesheet.deleteMany({})
    await prisma.leaveRequest.deleteMany({})
    await prisma.sponsorship.deleteMany({})
    await prisma.employee.deleteMany({
      where: { email: { contains: 'employees-security@test.com' } },
    })

    const employee = await prisma.employee.create({
      data: {
        firstName: 'Employees',
        lastName: 'Security',
        email: 'employees-security@test.com',
        jobTitle: 'Tester',
        employeeType: 'EMPLOYEE',
      },
    })

    employeeId = employee.id
  })

  afterAll(async () => {
    await prisma.document.deleteMany({ where: { employeeId } })
    await prisma.timesheet.deleteMany({ where: { employeeId } })
    await prisma.leaveRequest.deleteMany({ where: { employeeId } })
    await prisma.sponsorship.deleteMany({ where: { employeeId } })
    await prisma.employee.deleteMany({ where: { id: employeeId } })
    await prisma.$disconnect()
  })

  it('rejects employee creation for non-admin users', async () => {
    const response = await request(app)
      .post('/api/employees')
      .set('Authorization', authHeader({ id: 90, email: 'user@test.com', role: 'USER' }))
      .send({
        firstName: 'Blocked',
        lastName: 'User',
        email: 'blocked-user@test.com',
        employeeType: 'EMPLOYEE',
      })

    expect(response.status).toBe(403)
  })

  it('rejects employee updates for non-admin users', async () => {
    const response = await request(app)
      .put(`/api/employees/${employeeId}`)
      .set('Authorization', authHeader({ id: 91, email: 'user@test.com', role: 'USER' }))
      .send({ jobTitle: 'Mutated' })

    expect(response.status).toBe(403)
  })

  it('rejects employee deletion for non-admin users', async () => {
    const response = await request(app)
      .delete(`/api/employees/${employeeId}`)
      .set('Authorization', authHeader({ id: 92, email: 'user@test.com', role: 'USER' }))

    expect(response.status).toBe(403)
  })
})

describe('user employee management permissions', () => {
  let prefix: string

  beforeAll(() => {
    prefix = uniquePrefix('employee-management')
  })

  afterAll(async () => {
    await cleanupFixturePrefix(prefix)
  })

  it('allows admins to assign ADMIN, DIRECTOR, OFFICE_ASSISTANT, and EMPLOYEE roles', async () => {
    for (const role of ['ADMIN', 'DIRECTOR', 'OFFICE_ASSISTANT', 'EMPLOYEE']) {
      const user = await createUser(`${prefix}-${role.toLowerCase()}`, {
        email: `${prefix}-${role.toLowerCase()}@example.com`,
        role: 'EMPLOYEE',
      })

      const response = await request(app)
        .put(`/api/auth/users/${user.id}`)
        .set('Authorization', authHeader({ id: 100, email: `${prefix}.admin@example.com`, role: 'ADMIN' }))
        .send({ role })

      expect(response.status).toBe(200)
      expect(response.body.role).toBe(role)
    }
  })

  it('allows directors to manage non-admin user roles', async () => {
    for (const role of ['DIRECTOR', 'OFFICE_ASSISTANT', 'EMPLOYEE']) {
      const user = await createUser(`${prefix}-director-${role.toLowerCase()}`, {
        email: `${prefix}-director-${role.toLowerCase()}@example.com`,
        role: 'EMPLOYEE',
      })

      const response = await request(app)
        .put(`/api/auth/users/${user.id}`)
        .set('Authorization', authHeader({ id: 101, email: `${prefix}.director@example.com`, role: 'DIRECTOR' }))
        .send({ role })

      expect(response.status).toBe(200)
      expect(response.body.role).toBe(role)
    }
  })

  it('prevents directors from assigning ADMIN', async () => {
    const user = await createUser(`${prefix}-director-admin`, {
      email: `${prefix}-director-admin@example.com`,
      role: 'EMPLOYEE',
    })

    const response = await request(app)
      .put(`/api/auth/users/${user.id}`)
      .set('Authorization', authHeader({ id: 102, email: `${prefix}.director@example.com`, role: 'DIRECTOR' }))
      .send({ role: 'ADMIN' })

    expect(response.status).toBe(403)
    expect(response.body.error).toMatch(/permission/i)
  })

  it('prevents directors from mutating or deleting existing admin accounts', async () => {
    const admin = await createUser(`${prefix}-protected-admin`, {
      email: `${prefix}-protected-admin@example.com`,
      role: 'ADMIN',
    })

    const updateResponse = await request(app)
      .put(`/api/auth/users/${admin.id}`)
      .set('Authorization', authHeader({ id: 103, email: `${prefix}.director@example.com`, role: 'DIRECTOR' }))
      .send({ name: 'Director Mutation', role: 'DIRECTOR' })

    expect(updateResponse.status).toBe(403)

    const deleteResponse = await request(app)
      .delete(`/api/auth/users/${admin.id}`)
      .set('Authorization', authHeader({ id: 104, email: `${prefix}.director@example.com`, role: 'DIRECTOR' }))

    expect(deleteResponse.status).toBe(403)

    const persisted = await prisma.user.findUnique({ where: { id: admin.id } })
    expect(persisted?.role).toBe('ADMIN')
  })

  it('includes linked user account data with normalized roles for elevated employee list access', async () => {
    const employee = await createEmployee(`${prefix}-linked-employee`, {
      email: `${prefix}-linked-employee@example.com`,
    })
    await createUser(`${prefix}-linked-user`, {
      email: employee.email,
      employeeId: employee.id,
      role: 'MANAGER',
    })

    const response = await request(app)
      .get('/api/employees')
      .set('Authorization', authHeader({ id: 105, email: `${prefix}.admin@example.com`, role: 'ADMIN' }))

    expect(response.status).toBe(200)
    const returned = response.body.find((item: any) => item.id === employee.id)
    expect(returned.user).toEqual(
      expect.objectContaining({
        email: employee.email,
        role: 'DIRECTOR',
        employeeId: employee.id,
      }),
    )
  })

  it('persists expanded HR employee details from the unified form', async () => {
    const response = await request(app)
      .post('/api/employees')
      .set('Authorization', authHeader({ id: 108, email: `${prefix}.admin@example.com`, role: 'ADMIN' }))
      .send({
        firstName: 'Expanded',
        middleName: 'HR',
        lastName: 'Record',
        email: `${prefix}-expanded-record@example.com`,
        employeeType: 'EMPLOYEE',
        jobTitle: 'Consultant',
        startDate: '2026-05-03',
        probationEndDate: '2026-08-03',
        address1: '1 High Street',
        townCity: 'London',
        postcode: 'SW1A 1AA',
        accountName: 'Expanded Record',
        bankBranch: 'London',
        salary: '45000',
        paymentFrequency: 'Monthly',
        payrollNumber: 'ABC123',
        taxCode: '1257L',
        passportNumber: '123456789',
        passportExpiryDate: '2030-05-03',
        visaNumber: 'VISA123',
        visaExpiryDate: '2028-05-03',
      })

    expect(response.status).toBe(200)
    expect(response.body).toEqual(
      expect.objectContaining({
        middleName: 'HR',
        address1: '1 High Street',
        townCity: 'London',
        postcode: 'SW1A 1AA',
        accountName: 'Expanded Record',
        bankBranch: 'London',
        salary: 45000,
        paymentFrequency: 'Monthly',
        payrollNumber: 'ABC123',
        taxCode: '1257L',
        passportNumber: '123456789',
        visaNumber: 'VISA123',
      }),
    )
  })

  it('redacts sensitive employee fields for office assistant list access', async () => {
    const employee = await createEmployee(`${prefix}-sensitive-employee`, {
      email: `${prefix}-sensitive-employee@example.com`,
      niNumber: 'QQ123456C',
      bankName: 'Sensitive Bank',
      accountName: 'Sensitive Account',
      accountNumber: '12345678',
      sortCode: '112233',
      salary: 55000,
      taxCode: '1257L',
      passportNumber: '123456789',
      visaNumber: 'VISA123',
      emergencyContactAddress: '1 Sensitive Street',
    })

    const response = await request(app)
      .get('/api/employees')
      .set('Authorization', authHeader({ id: 106, email: `${prefix}.office@example.com`, role: 'OFFICE_ASSISTANT' }))

    expect(response.status).toBe(200)
    const returned = response.body.find((item: any) => item.id === employee.id)
    expect(returned).toEqual(
      expect.objectContaining({
        id: employee.id,
        email: employee.email,
        niNumber: null,
        bankName: null,
        accountName: null,
        accountNumber: null,
        sortCode: null,
        salary: null,
        taxCode: null,
        passportNumber: null,
        visaNumber: null,
        emergencyContactAddress: null,
      }),
    )
    expect(returned.consents).toBeUndefined()
    expect(returned.consentCount).toBeUndefined()
  })

  it('prevents office assistants from creating, editing, or deleting employees', async () => {
    const employee = await createEmployee(`${prefix}-office-blocked`, {
      email: `${prefix}-office-blocked@example.com`,
    })
    const token = authHeader({ id: 107, email: `${prefix}.office@example.com`, role: 'OFFICE_ASSISTANT' })

    const createResponse = await request(app)
      .post('/api/employees')
      .set('Authorization', token)
      .send({
        firstName: 'Blocked',
        lastName: 'Assistant',
        email: `${prefix}-blocked-create@example.com`,
        employeeType: 'EMPLOYEE',
      })

    expect(createResponse.status).toBe(403)

    const updateResponse = await request(app)
      .put(`/api/employees/${employee.id}`)
      .set('Authorization', token)
      .send({ jobTitle: 'Blocked Mutation' })

    expect(updateResponse.status).toBe(403)

    const deleteResponse = await request(app)
      .delete(`/api/employees/${employee.id}`)
      .set('Authorization', token)

    expect(deleteResponse.status).toBe(403)
  })
})
