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
  let userToken: string
  let unlinkedUserToken: string
  let officeAssistantToken: string
  let testEmployeeId: number
  let secondEmployeeId: number
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

    const secondEmployee = await prisma.employee.create({
      data: {
        firstName: 'Other',
        lastName: 'User',
        email: 'other@documents.com',
        jobTitle: 'Tester',
        employeeType: 'EMPLOYEE'
      }
    })
    secondEmployeeId = secondEmployee.id

    // Mock auth token (valid JWT signed with test secret)
    authToken = 'Bearer ' + jwt.sign({ email: employee.email, role: 'ADMIN' }, process.env.JWT_SECRET || 'test-secret-key')
    userToken = 'Bearer ' + jwt.sign({ email: employee.email, role: 'USER', employeeId: employee.id }, process.env.JWT_SECRET || 'test-secret-key')
    unlinkedUserToken = 'Bearer ' + jwt.sign({ email: 'unlinked@documents.com', role: 'USER' }, process.env.JWT_SECRET || 'test-secret-key')
    officeAssistantToken = 'Bearer ' + jwt.sign({ email: 'office@documents.com', role: 'OFFICE_ASSISTANT' }, process.env.JWT_SECRET || 'test-secret-key')
  })

  afterAll(async () => {
    // Clean up test data
    if (testDocumentId) {
      await prisma.document.delete({ where: { id: testDocumentId } }).catch(() => {})
    }
    await prisma.employee.delete({ where: { id: testEmployeeId } }).catch(() => {})
    await prisma.employee.delete({ where: { id: secondEmployeeId } }).catch(() => {})
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

    it('should reject upload for non-admin users', async () => {
      const response = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', userToken)
        .field('employeeId', testEmployeeId.toString())
        .field('name', 'Blocked Document')
        .attach('file', Buffer.from('test'), 'blocked.pdf')

      expect(response.status).toBe(403)
    })

    it('allows office assistants to upload documents for employees', async () => {
      const response = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', officeAssistantToken)
        .field('employeeId', testEmployeeId.toString())
        .field('name', 'Office Assistant Upload')
        .field('type', 'CONTRACT')
        .attach('file', Buffer.from('office upload'), 'office-upload.pdf')

      expect(response.status).toBe(200)
      expect(response.body.name).toBe('Office Assistant Upload')
      expect(response.body.employeeId).toBe(testEmployeeId)

      await prisma.document.delete({ where: { id: response.body.id } })
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

    it('allows elevated users to list documents for a selected employee only', async () => {
      const ownDoc = await prisma.document.create({
        data: {
          employeeId: testEmployeeId,
          name: 'Selected Employee Doc',
          path: '/uploads/selected-employee.pdf',
          type: 'CONTRACT'
        }
      })
      const otherDoc = await prisma.document.create({
        data: {
          employeeId: secondEmployeeId,
          name: 'Other Employee Doc',
          path: '/uploads/other-employee.pdf',
          type: 'PASSPORT'
        }
      })

      const response = await request(app)
        .get(`/api/documents?employeeId=${testEmployeeId}`)
        .set('Authorization', authToken)

      expect(response.status).toBe(200)
      expect(response.body.some((document: any) => document.id === ownDoc.id)).toBe(true)
      expect(response.body.some((document: any) => document.id === otherDoc.id)).toBe(false)

      await prisma.document.deleteMany({ where: { id: { in: [ownDoc.id, otherDoc.id] } } })
    })

    it('keeps employee document lists scoped to their own employee record', async () => {
      const ownDoc = await prisma.document.create({
        data: {
          employeeId: testEmployeeId,
          name: 'Own Employee Doc',
          path: '/uploads/own-employee.pdf',
          type: 'CONTRACT'
        }
      })
      const otherDoc = await prisma.document.create({
        data: {
          employeeId: secondEmployeeId,
          name: 'Blocked Other Employee Doc',
          path: '/uploads/blocked-other-employee.pdf',
          type: 'PASSPORT'
        }
      })

      const response = await request(app)
        .get('/api/documents')
        .set('Authorization', userToken)

      expect(response.status).toBe(200)
      expect(response.body.some((document: any) => document.id === ownDoc.id)).toBe(true)
      expect(response.body.some((document: any) => document.id === otherDoc.id)).toBe(false)

      await prisma.document.deleteMany({ where: { id: { in: [ownDoc.id, otherDoc.id] } } })
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

    it('returns no expiring documents for unlinked employees', async () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 15)

      const doc = await prisma.document.create({
        data: {
          employeeId: testEmployeeId,
          name: 'Unlinked Leak Check',
          path: '/test/path.pdf',
          type: 'VISA',
          expiryDate: futureDate
        }
      })

      const response = await request(app)
        .get('/api/documents/expiring')
        .set('Authorization', unlinkedUserToken)

      expect(response.status).toBe(200)
      expect(response.body).toEqual([])

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

  describe('GET /documents/:id/file', () => {
    it('should allow an authenticated admin to fetch a document file', async () => {
      const uploadsDir = path.join(process.cwd(), 'uploads')
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true })
      }
      const testFilePath = path.join(uploadsDir, 'test-open.pdf')
      fs.writeFileSync(testFilePath, 'Open content')

      const doc = await prisma.document.create({
        data: {
          employeeId: testEmployeeId,
          name: 'Open Test.pdf',
          path: '/uploads/test-open.pdf',
          type: 'OTHER'
        }
      })

      const response = await request(app)
        .get(`/api/documents/${doc.id}/file`)
        .set('Authorization', authToken)

      expect(response.status).toBe(200)
      expect(response.headers['content-disposition']).toContain('Open Test.pdf')

      await prisma.document.delete({ where: { id: doc.id } })
      fs.unlinkSync(testFilePath)
    })

    it('serves previewable documents inline when requested', async () => {
      const uploadsDir = path.join(process.cwd(), 'uploads')
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true })
      }
      const testFilePath = path.join(uploadsDir, 'test-preview.pdf')
      fs.writeFileSync(testFilePath, 'Preview content')

      const doc = await prisma.document.create({
        data: {
          employeeId: testEmployeeId,
          name: 'Preview Test.pdf',
          path: '/uploads/test-preview.pdf',
          type: 'CONTRACT'
        }
      })

      const response = await request(app)
        .get(`/api/documents/${doc.id}/file?disposition=inline`)
        .set('Authorization', userToken)

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toContain('application/pdf')
      expect(response.headers['content-disposition']).toContain('inline')
      expect(response.headers['content-disposition']).toContain('Preview Test.pdf')

      await prisma.document.delete({ where: { id: doc.id } })
      fs.unlinkSync(testFilePath)
    })

    it('allows office assistants to download employee documents', async () => {
      const uploadsDir = path.join(process.cwd(), 'uploads')
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true })
      }
      const testFilePath = path.join(uploadsDir, 'test-office-download.pdf')
      fs.writeFileSync(testFilePath, 'Office download content')

      const doc = await prisma.document.create({
        data: {
          employeeId: testEmployeeId,
          name: 'Office Download.pdf',
          path: '/uploads/test-office-download.pdf',
          type: 'OTHER'
        }
      })

      const response = await request(app)
        .get(`/api/documents/${doc.id}/file`)
        .set('Authorization', officeAssistantToken)

      expect(response.status).toBe(200)
      expect(response.headers['content-disposition']).toContain('Office Download.pdf')

      await prisma.document.delete({ where: { id: doc.id } })
      fs.unlinkSync(testFilePath)
    })
  })

  describe('POST /documents/:id/share-link and GET /documents/share/:token', () => {
    it('should create a share link and allow public download through the token', async () => {
      const uploadsDir = path.join(process.cwd(), 'uploads')
      const testFilePath = path.join(uploadsDir, 'test-share.pdf')
      fs.writeFileSync(testFilePath, 'Share content')

      const doc = await prisma.document.create({
        data: {
          employeeId: testEmployeeId,
          name: 'Share Test.pdf',
          path: '/uploads/test-share.pdf',
          type: 'PAYSLIP'
        }
      })

      const shareResponse = await request(app)
        .post(`/api/documents/${doc.id}/share-link`)
        .set('Authorization', authToken)

      expect(shareResponse.status).toBe(200)
      expect(shareResponse.body.shareToken).toBeTruthy()
      expect(shareResponse.body.shareUrl).toContain('/api/documents/share/')

      const publicResponse = await request(app)
        .get(`/api/documents/share/${shareResponse.body.shareToken}`)

      expect(publicResponse.status).toBe(200)
      expect(publicResponse.headers['content-disposition']).toContain('Share Test.pdf')

      await prisma.document.delete({ where: { id: doc.id } })
      fs.unlinkSync(testFilePath)
    })

    it('should reject share link generation for non-admin users', async () => {
      const doc = await prisma.document.create({
        data: {
          employeeId: testEmployeeId,
          name: 'Blocked Share.pdf',
          path: '/uploads/test-share.pdf',
          type: 'PAYSLIP'
        }
      })

      const response = await request(app)
        .post(`/api/documents/${doc.id}/share-link`)
        .set('Authorization', userToken)

      expect(response.status).toBe(403)

      await prisma.document.delete({ where: { id: doc.id } })
    })
  })

  describe('POST /documents/upload-payslips', () => {
    it('should bulk upload payslips and create share links', async () => {
      const response = await request(app)
        .post('/api/documents/upload-payslips')
        .set('Authorization', authToken)
        .field('employeeId', testEmployeeId.toString())
        .attach('files', Buffer.from('payslip one'), 'payslip-april.pdf')
        .attach('files', Buffer.from('payslip two'), 'payslip-may.pdf')

      expect(response.status).toBe(200)
      expect(response.body.uploadedCount).toBe(2)
      expect(response.body.documents.every((doc: any) => doc.type === 'PAYSLIP')).toBe(true)
      expect(response.body.documents.every((doc: any) => doc.shareUrl)).toBe(true)
    })

    it('allows office assistants to upload payslips', async () => {
      const response = await request(app)
        .post('/api/documents/upload-payslips')
        .set('Authorization', officeAssistantToken)
        .field('employeeId', testEmployeeId.toString())
        .attach('files', Buffer.from('office payslip'), 'office-payslip.pdf')

      expect(response.status).toBe(200)
      expect(response.body.uploadedCount).toBe(1)
      expect(response.body.documents[0].type).toBe('PAYSLIP')
      expect(response.body.documents[0].shareUrl).toBeTruthy()
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

    it('prevents office assistants from deleting documents', async () => {
      const doc = await prisma.document.create({
        data: {
          employeeId: testEmployeeId,
          name: 'Office Delete Block',
          path: '/uploads/non-existent-office-delete.pdf',
          type: 'OTHER'
        }
      })

      const response = await request(app)
        .delete(`/api/documents/${doc.id}`)
        .set('Authorization', officeAssistantToken)

      expect(response.status).toBe(403)

      await prisma.document.delete({ where: { id: doc.id } })
    })
  })
})
