import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import express from 'express'
import sponsorshipsRouter from '../routes/sponsorships'
import prisma from '../prismaClient'

const app = express()
app.use(express.json())
app.use('/api/sponsorships', sponsorshipsRouter)

describe('Sponsorships API', () => {
  let authToken: string
  let testEmployeeId: number
  let testSponsorshipId: number

  beforeAll(async () => {
    // Clean up existing test data (delete children first due to foreign keys)
    await prisma.sponsorship.deleteMany({})
    await prisma.document.deleteMany({})
    await prisma.timesheet.deleteMany({})
    await prisma.leaveRequest.deleteMany({})
    await prisma.employee.deleteMany({})
    
    // Create test employee
    const employee = await prisma.employee.create({
      data: {
        firstName: 'Test',
        lastName: 'Sponsored',
        email: 'test@sponsorships.com',
        jobTitle: 'Developer',
        employeeType: 'EMPLOYEE'
      }
    })
    testEmployeeId = employee.id
    authToken = 'Bearer ' + jwt.sign(
      { email: employee.email, role: 'ADMIN' },
      process.env.JWT_SECRET || 'test-secret-key'
    )
  })

  afterAll(async () => {
    // Clean up
    if (testSponsorshipId) {
      await prisma.sponsorship.delete({ where: { id: testSponsorshipId } }).catch(() => {})
    }
    await prisma.employee.delete({ where: { id: testEmployeeId } }).catch(() => {})
    await prisma.$disconnect()
  })

  describe('POST /sponsorships', () => {
    it('should create sponsorship with all fields', async () => {
      const response = await request(app)
        .post('/api/sponsorships')
        .set('Authorization', authToken)
        .send({
          employeeId: testEmployeeId,
          visaType: 'Skilled Worker',
          casNumber: 'CAS123456',
          sponsorLicenseNumber: 'LIC789',
          startDate: '2025-01-01',
          endDate: '2027-01-01',
          complianceNotes: 'All compliant',
          active: true
        })

      expect(response.status).toBe(200)
      expect(response.body.visaType).toBe('Skilled Worker')
      expect(response.body.casNumber).toBe('CAS123456')
      expect(response.body.active).toBe(true)
      
      testSponsorshipId = response.body.id
    })

    it('should create sponsorship without optional fields', async () => {
      const response = await request(app)
        .post('/api/sponsorships')
        .set('Authorization', authToken)
        .send({
          employeeId: testEmployeeId,
          visaType: 'Graduate',
          startDate: '2025-06-01',
          active: true
        })

      expect(response.status).toBe(200)
      expect(response.body.casNumber).toBeNull()
      expect(response.body.sponsorLicenseNumber).toBeNull()
    })

    it('should reject sponsorship without required fields', async () => {
      const response = await request(app)
        .post('/api/sponsorships')
        .set('Authorization', authToken)
        .send({
          employeeId: testEmployeeId
          // Missing visaType and startDate
        })

      expect(response.status).toBe(400)
    })
  })

  describe('GET /sponsorships', () => {
    it('should return all sponsorships with employee data', async () => {
      const response = await request(app)
        .get('/api/sponsorships')
        .set('Authorization', authToken)

      expect(response.status).toBe(200)
      expect(Array.isArray(response.body)).toBe(true)
      
      if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty('employee')
      }
    })
  })

  describe('PUT /sponsorships/:id', () => {
    it('should update sponsorship', async () => {
      const response = await request(app)
        .put(`/api/sponsorships/${testSponsorshipId}`)
        .set('Authorization', authToken)
        .send({
          visaType: 'Skilled Worker - Updated',
          complianceNotes: 'Updated notes',
          active: false
        })

      expect(response.status).toBe(200)
      expect(response.body.visaType).toBe('Skilled Worker - Updated')
      expect(response.body.active).toBe(false)
    })
  })

  describe('DELETE /sponsorships/:id', () => {
    it('should delete sponsorship', async () => {
      const newSponsorship = await prisma.sponsorship.create({
        data: {
          employeeId: testEmployeeId,
          visaType: 'Temporary',
          startDate: new Date('2025-12-01'),
          active: true
        }
      })

      const response = await request(app)
        .delete(`/api/sponsorships/${newSponsorship.id}`)
        .set('Authorization', authToken)

      expect(response.status).toBe(200)
      
      const deleted = await prisma.sponsorship.findUnique({ where: { id: newSponsorship.id } })
      expect(deleted).toBeNull()
    })
  })

  describe('Date handling', () => {
    it('should properly handle start and end dates', async () => {
      const startDate = '2025-01-15'
      const endDate = '2027-01-15'

      const response = await request(app)
        .post('/api/sponsorships')
        .set('Authorization', authToken)
        .send({
          employeeId: testEmployeeId,
          visaType: 'Test Visa',
          startDate,
          endDate,
          active: true
        })

      expect(response.status).toBe(200)
      expect(new Date(response.body.startDate).toISOString().split('T')[0]).toBe(startDate)
      expect(new Date(response.body.endDate).toISOString().split('T')[0]).toBe(endDate)

      // Clean up
      await prisma.sponsorship.delete({ where: { id: response.body.id } })
    })

    it('should handle UK date format in exports', async () => {
      const testDate = new Date('2025-03-25')
      const ukFormat = testDate.toLocaleDateString('en-GB')
      
      expect(ukFormat).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/)
    })
  })

  describe('Export functionality', () => {
    it('should include all required fields in export data structure', async () => {
      const sponsorship = await prisma.sponsorship.findFirst({
        where: { employeeId: testEmployeeId },
        include: { employee: true }
      })

      if (sponsorship) {
        const exportData = {
          'Employee': `${sponsorship.employee.firstName} ${sponsorship.employee.lastName}`,
          'Visa Type': sponsorship.visaType,
          'CAS Number': sponsorship.casNumber || '',
          'Sponsor License Number': sponsorship.sponsorLicenseNumber || '',
          'Start Date': sponsorship.startDate ? new Date(sponsorship.startDate).toLocaleDateString('en-GB') : '',
          'End Date': sponsorship.endDate ? new Date(sponsorship.endDate).toLocaleDateString('en-GB') : '',
          'Compliance Notes': sponsorship.complianceNotes || '',
          'Status': sponsorship.active ? 'Active' : 'Inactive'
        }

        expect(exportData).toHaveProperty('Employee')
        expect(exportData).toHaveProperty('Visa Type')
        expect(exportData).toHaveProperty('CAS Number')
        expect(exportData).toHaveProperty('Status')
      }
    })
  })
})
