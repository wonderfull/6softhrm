import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import express from 'express'
import timesheetsRouter from '../routes/timesheets'
import prisma from '../prismaClient'

const app = express()
app.use(express.json())
app.use('/api/timesheets', timesheetsRouter)

describe('Timesheets API', () => {
  let authToken: string
  let employeeToken: string
  let linkedDirectorToken: string
  let unlinkedEmployeeToken: string
  let officeAssistantToken: string
  let testEmployeeId: number
  let secondEmployeeId: number
  let testProjectId: number
  let testTimesheetId: number

  beforeAll(async () => {
    // Clean up existing test data (delete children first due to foreign keys)
    await prisma.timesheet.deleteMany({})
    await prisma.document.deleteMany({})
    await prisma.leaveRequest.deleteMany({})
    await prisma.sponsorship.deleteMany({})
    await prisma.employee.deleteMany({})
    await prisma.project.deleteMany({})
    
    // Create test employee
    const employee = await prisma.employee.create({
      data: {
        firstName: 'Test',
        lastName: 'Employee',
        email: 'test@timesheets.com',
        jobTitle: 'Developer',
        employeeType: 'EMPLOYEE'
      }
    })
    testEmployeeId = employee.id

    const secondEmployee = await prisma.employee.create({
      data: {
        firstName: 'Second',
        lastName: 'Employee',
        email: 'second@timesheets.com',
        jobTitle: 'Designer',
        employeeType: 'EMPLOYEE'
      }
    })
    secondEmployeeId = secondEmployee.id

    // Create test project
    const project = await prisma.project.create({
      data: {
        name: 'Test Project',
        code: 'TP1',
        active: true
      }
    })
    testProjectId = project.id

    authToken = 'Bearer ' + jwt.sign({ email: employee.email, role: 'ADMIN' }, process.env.JWT_SECRET || 'test-secret-key')
    employeeToken = 'Bearer ' + jwt.sign({ email: employee.email, role: 'EMPLOYEE', employeeId: employee.id }, process.env.JWT_SECRET || 'test-secret-key')
    linkedDirectorToken = 'Bearer ' + jwt.sign({ email: 'director@timesheets.com', role: 'DIRECTOR', employeeId: employee.id }, process.env.JWT_SECRET || 'test-secret-key')
    unlinkedEmployeeToken = 'Bearer ' + jwt.sign({ email: 'unlinked@timesheets.com', role: 'EMPLOYEE' }, process.env.JWT_SECRET || 'test-secret-key')
    officeAssistantToken = 'Bearer ' + jwt.sign({ email: 'office@timesheets.com', role: 'OFFICE_ASSISTANT' }, process.env.JWT_SECRET || 'test-secret-key')
  })

  afterAll(async () => {
    // Clean up
    if (testTimesheetId) {
      await prisma.timesheet.delete({ where: { id: testTimesheetId } }).catch(() => {})
    }
    await prisma.project.delete({ where: { id: testProjectId } }).catch(() => {})
    await prisma.employee.delete({ where: { id: secondEmployeeId } }).catch(() => {})
    await prisma.employee.delete({ where: { id: testEmployeeId } }).catch(() => {})
    await prisma.$disconnect()
  })

  describe('POST /timesheets', () => {
    it('should create timesheet with all fields', async () => {
      const response = await request(app)
        .post('/api/timesheets')
        .set('Authorization', authToken)
        .send({
          employeeId: testEmployeeId,
          projectId: testProjectId,
          date: '2025-11-19',
          hours: 8,
          notes: 'Test work'
        })

      expect(response.status).toBe(200)
      expect(response.body.hours).toBe(8)
      expect(response.body.notes).toBe('Test work')
      
      testTimesheetId = response.body.id
    })

    it('should create timesheet without optional project', async () => {
      const response = await request(app)
        .post('/api/timesheets')
        .set('Authorization', authToken)
        .send({
          employeeId: testEmployeeId,
          date: '2025-11-20',
          hours: 6
        })

      expect(response.status).toBe(200)
      expect(response.body.projectId).toBeNull()
    })

    it('should reject timesheet without required fields', async () => {
      const response = await request(app)
        .post('/api/timesheets')
        .set('Authorization', authToken)
        .send({
          employeeId: testEmployeeId
          // Missing date and hours
        })

      expect(response.status).toBe(400)
    })

    it('allows linked directors to record their own timesheet without choosing an employee', async () => {
      const response = await request(app)
        .post('/api/timesheets')
        .set('Authorization', linkedDirectorToken)
        .send({
          date: '2025-11-21',
          hours: 7,
          notes: 'Director self-service time',
        })

      expect(response.status).toBe(200)
      expect(response.body.employeeId).toBe(testEmployeeId)
    })
  })

  describe('GET /timesheets', () => {
    it('should return all timesheets with employee and project data', async () => {
      const response = await request(app)
        .get('/api/timesheets')
        .set('Authorization', authToken)

      expect(response.status).toBe(200)
      expect(Array.isArray(response.body)).toBe(true)
      
      if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty('employee')
      }
    })

    it('returns no timesheets for unlinked employees', async () => {
      await prisma.timesheet.create({
        data: {
          employeeId: testEmployeeId,
          date: new Date('2025-11-22'),
          hours: 4
        }
      })

      const response = await request(app)
        .get('/api/timesheets')
        .set('Authorization', unlinkedEmployeeToken)

      expect(response.status).toBe(200)
      expect(response.body).toEqual([])
    })

    it('allows office assistants to view operational time records', async () => {
      const response = await request(app)
        .get('/api/timesheets')
        .set('Authorization', officeAssistantToken)

      expect(response.status).toBe(200)
      expect(Array.isArray(response.body)).toBe(true)
    })
  })

  describe('PUT /timesheets/:id', () => {
    it('should update timesheet', async () => {
      const response = await request(app)
        .put(`/api/timesheets/${testTimesheetId}`)
        .set('Authorization', authToken)
        .send({
          hours: 10,
          notes: 'Updated notes'
        })

      expect(response.status).toBe(200)
      expect(response.body.hours).toBe(10)
      expect(response.body.notes).toBe('Updated notes')
    })

    it('prevents employees from updating another employee timesheet', async () => {
      const otherTimesheet = await prisma.timesheet.create({
        data: {
          employeeId: secondEmployeeId,
          date: new Date('2025-11-23'),
          hours: 5
        }
      })

      const response = await request(app)
        .put(`/api/timesheets/${otherTimesheet.id}`)
        .set('Authorization', employeeToken)
        .send({ hours: 9 })

      expect(response.status).toBe(403)

      await prisma.timesheet.delete({ where: { id: otherTimesheet.id } })
    })

    it('allows office assistants to update operational time records', async () => {
      const operationalTimesheet = await prisma.timesheet.create({
        data: {
          employeeId: testEmployeeId,
          date: new Date('2025-11-24'),
          hours: 6
        }
      })

      const response = await request(app)
        .put(`/api/timesheets/${operationalTimesheet.id}`)
        .set('Authorization', officeAssistantToken)
        .send({ hours: 7, notes: 'Office update' })

      expect(response.status).toBe(200)
      expect(response.body.hours).toBe(7)
      expect(response.body.notes).toBe('Office update')

      await prisma.timesheet.delete({ where: { id: operationalTimesheet.id } })
    })
  })

  describe('DELETE /timesheets/:id', () => {
    it('should delete timesheet', async () => {
      const newTimesheet = await prisma.timesheet.create({
        data: {
          employeeId: testEmployeeId,
          date: new Date('2025-11-21'),
          hours: 5
        }
      })

      const response = await request(app)
        .delete(`/api/timesheets/${newTimesheet.id}`)
        .set('Authorization', authToken)

      expect(response.status).toBe(200)
      
      const deleted = await prisma.timesheet.findUnique({ where: { id: newTimesheet.id } })
      expect(deleted).toBeNull()
    })

    it('prevents employees from deleting another employee timesheet', async () => {
      const otherTimesheet = await prisma.timesheet.create({
        data: {
          employeeId: secondEmployeeId,
          date: new Date('2025-11-25'),
          hours: 5
        }
      })

      const response = await request(app)
        .delete(`/api/timesheets/${otherTimesheet.id}`)
        .set('Authorization', employeeToken)

      expect(response.status).toBe(403)

      await prisma.timesheet.delete({ where: { id: otherTimesheet.id } })
    })
  })

  describe('Monthly view calculations', () => {
    it('should accurately calculate monthly hours', async () => {
      // Create multiple timesheets for the month
      const date1 = new Date('2025-11-01')
      const date2 = new Date('2025-11-02')
      const date3 = new Date('2025-11-03')

      const ts1 = await prisma.timesheet.create({
        data: { employeeId: testEmployeeId, date: date1, hours: 8 }
      })
      const ts2 = await prisma.timesheet.create({
        data: { employeeId: testEmployeeId, date: date2, hours: 7 }
      })
      const ts3 = await prisma.timesheet.create({
        data: { employeeId: testEmployeeId, date: date3, hours: 9 }
      })

      const response = await request(app)
        .get('/api/timesheets')
        .set('Authorization', authToken)

      expect(response.status).toBe(200)
      
      // Calculate total for employee
      const employeeSheets = response.body.filter((ts: any) => ts.employeeId === testEmployeeId)
      const totalHours = employeeSheets.reduce((sum: number, ts: any) => sum + ts.hours, 0)
      expect(totalHours).toBeGreaterThanOrEqual(24) // At least our 3 test entries

      // Clean up
      await prisma.timesheet.deleteMany({
        where: { id: { in: [ts1.id, ts2.id, ts3.id] } }
      })
    })
  })
})
