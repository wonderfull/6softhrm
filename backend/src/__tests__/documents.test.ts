import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import express from 'express'
import documentsRouter from '../routes/documents'
import prisma from '../prismaClient'
import fs from 'fs'
import path from 'path'

const app = express()
app.use(express.json())
app.use('/api/documents', documentsRouter)

describe('Documents API', () => {
  let authToken: string
  let testEmployeeId: number
  let testDocumentId: number

  beforeAll(async () => {
    // Clean up existing test data (delete children first due to foreign keys)
    await prisma.document.deleteMany({})
    await prisma.timesheet.deleteMany({})
    await prisma.leaveRequest.deleteMany({})
    await prisma.sponsorship.deleteMany({})
    await prisma.employee.deleteMany({})
    
    // Create test employee
    const employee = await prisma.employee.create({
      data: {
        firstName: 'Test',
        lastName: 'User',
        email: 'test@documents.com',
        jobTitle: 'Tester',
        employeeType: 'EMPLOYEE'
      }
    })
    testEmployeeId = employee.id

    // Mock auth token (valid JWT signed with test secret)
    authToken = 'Bearer ' + jwt.sign({ email: employee.email, role: 'ADMIN' }, process.env.JWT_SECRET || 'test-secret-key')
  })

  afterAll(async () => {
    // Clean up test data
    if (testDocumentId) {
      await prisma.document.delete({ where: { id: testDocumentId } }).catch(() => {})
    }
    await prisma.employee.delete({ where: { id: testEmployeeId } }).catch(() => {})
    await prisma.$disconnect()
  })

  describe('POST /documents/upload', () => {
    it('should upload document with type and expiry date', async () => {
      const response = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', authToken)
        .field('employeeId', testEmployeeId.toString())
        .field('name', 'Test Document')
        .field('type', 'CONTRACT')
        .field('expiryDate', '2025-12-31')
        .attach('file', Buffer.from('test'), 'test.pdf')

      expect(response.status).toBe(200)
      expect(response.body.name).toBe('Test Document')
      expect(response.body.type).toBe('CONTRACT')
      expect(response.body.expiryDate).toBeTruthy()
      
      testDocumentId = response.body.id
    })

    it('should upload document without optional fields', async () => {
      const response = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', authToken)
        .field('employeeId', testEmployeeId.toString())
        .field('name', 'Simple Document')
        .attach('file', Buffer.from('test'), 'simple.pdf')

      expect(response.status).toBe(200)
      expect(response.body.type).toBeNull()
      expect(response.body.expiryDate).toBeNull()
    })

    it('should reject upload without required fields', async () => {
      const response = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', authToken)
        .attach('file', Buffer.from('test'), 'test.pdf')

      expect(response.status).toBe(400)
    })
  })

  describe('GET /documents', () => {
    it('should return all documents', async () => {
      const response = await request(app)
        .get('/api/documents')
        .set('Authorization', authToken)

      expect(response.status).toBe(200)
      expect(Array.isArray(response.body)).toBe(true)
    })
  })

  describe('GET /documents/expiring', () => {
    it('should return documents expiring in next 30 days', async () => {
      // Create document expiring soon
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 15)

      const doc = await prisma.document.create({
        data: {
          employeeId: testEmployeeId,
          name: 'Expiring Doc',
          path: '/test/path.pdf',
          type: 'VISA',
          expiryDate: futureDate
        }
      })

      const response = await request(app)
        .get('/api/documents/expiring')
        .set('Authorization', authToken)

      expect(response.status).toBe(200)
      expect(response.body.some((d: any) => d.id === doc.id)).toBe(true)

      // Clean up
      await prisma.document.delete({ where: { id: doc.id } })
    })

    it('should not return documents expiring after 30 days', async () => {
      // Create document expiring in 60 days
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 60)

      const doc = await prisma.document.create({
        data: {
          employeeId: testEmployeeId,
          name: 'Far Future Doc',
          path: '/test/path.pdf',
          type: 'PASSPORT',
          expiryDate: futureDate
        }
      })

      const response = await request(app)
        .get('/api/documents/expiring')
        .set('Authorization', authToken)

      expect(response.status).toBe(200)
      expect(response.body.some((d: any) => d.id === doc.id)).toBe(false)

      // Clean up
      await prisma.document.delete({ where: { id: doc.id } })
    })

    it('should not return expired documents', async () => {
      // Create expired document
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 10)

      const doc = await prisma.document.create({
        data: {
          employeeId: testEmployeeId,
          name: 'Expired Doc',
          path: '/test/path.pdf',
          type: 'ID',
          expiryDate: pastDate
        }
      })

      const response = await request(app)
        .get('/api/documents/expiring')
        .set('Authorization', authToken)

      expect(response.status).toBe(200)
      expect(response.body.some((d: any) => d.id === doc.id)).toBe(false)

      // Clean up
      await prisma.document.delete({ where: { id: doc.id } })
    })
  })

  describe('GET /documents/download-all/:employeeId', () => {
    it('should return 404 if employee has no documents', async () => {
      const newEmployee = await prisma.employee.create({
        data: {
          firstName: 'No',
          lastName: 'Docs',
          email: 'nodocs@test.com',
          jobTitle: 'Tester',
          employeeType: 'EMPLOYEE'
        }
      })

      const response = await request(app)
        .get(`/api/documents/download-all/${newEmployee.id}`)
        .set('Authorization', authToken)

      expect(response.status).toBe(404)

      // Clean up
      await prisma.employee.delete({ where: { id: newEmployee.id } })
    })

    it('should return 404 if employee not found', async () => {
      const response = await request(app)
        .get('/api/documents/download-all/999999')
        .set('Authorization', authToken)

      expect(response.status).toBe(404)
    })

    it('should return ZIP file for employee with documents', async () => {
      // Create test document file
      const uploadsDir = path.join(process.cwd(), 'uploads')
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true })
      }

      const testFilePath = path.join(uploadsDir, 'test-download.pdf')
      fs.writeFileSync(testFilePath, 'Test content')

      const doc = await prisma.document.create({
        data: {
          employeeId: testEmployeeId,
          name: 'Download Test',
          path: '/uploads/test-download.pdf',
          type: 'CONTRACT'
        }
      })

      const response = await request(app)
        .get(`/api/documents/download-all/${testEmployeeId}`)
        .set('Authorization', authToken)

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe('application/zip')
      expect(response.headers['content-disposition']).toContain('.zip')

      // Clean up
      await prisma.document.delete({ where: { id: doc.id } })
      fs.unlinkSync(testFilePath)
    })
  })

  describe('DELETE /documents/:id', () => {
    it('should delete document and file', async () => {
      // Create test file
      const uploadsDir = path.join(process.cwd(), 'uploads')
      const testFilePath = path.join(uploadsDir, 'test-delete.pdf')
      fs.writeFileSync(testFilePath, 'Test content')

      const doc = await prisma.document.create({
        data: {
          employeeId: testEmployeeId,
          name: 'Delete Test',
          path: '/uploads/test-delete.pdf',
          type: 'OTHER'
        }
      })

      const response = await request(app)
        .delete(`/api/documents/${doc.id}`)
        .set('Authorization', authToken)

      expect(response.status).toBe(200)
      
      // Verify document deleted from database
      const deletedDoc = await prisma.document.findUnique({ where: { id: doc.id } })
      expect(deletedDoc).toBeNull()
      
      // Verify file deleted
      expect(fs.existsSync(testFilePath)).toBe(false)
    })
  })
})
