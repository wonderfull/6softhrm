import path from 'path'
import { afterEach, beforeEach, describe, expect } from '@jest/globals'
import request from 'supertest'
import { defineFeature, loadFeature } from 'jest-cucumber'
import app from '../../app'
import { authHeader, cleanupFixturePrefix, createDocument, createEmployee, createUser, ensureUploadFile, uniquePrefix } from './helpers/fixtures'

const feature = loadFeature(path.join(__dirname, '../features/documents.feature'))

describe('BDD: documents', () => {
  let prefix: string

  beforeEach(() => {
    prefix = uniquePrefix('documents')
  })

  afterEach(async () => {
    await cleanupFixturePrefix(prefix)
  })

  defineFeature(feature, (test) => {
    test('Valid document upload succeeds', ({ given, when, then }) => {
      let response: request.Response
      let employeeId = 0
      let uploadPath = ''

      given('an existing employee record for document upload', async () => {
        const employee = await createEmployee(prefix, { email: `${prefix}.upload@example.com` })
        employeeId = employee.id
        uploadPath = ensureUploadFile(prefix, `${prefix}-upload.pdf`).absolutePath
      })

      when('an admin uploads a valid PDF document with an expiry date', async () => {
        response = await request(app)
          .post('/api/documents/upload')
          .set('Authorization', authHeader({ id: 30, email: `${prefix}.admin@example.com`, role: 'ADMIN' }))
          .field('employeeId', String(employeeId))
          .field('name', `${prefix} Upload`)
          .field('type', 'CONTRACT')
          .field('expiryDate', '2026-12-31')
          .attach('file', uploadPath)
      })

      then('the document is stored with the provided type and expiry date', () => {
        expect(response.status).toBe(200)
        expect(response.body.type).toBe('CONTRACT')
        expect(response.body.expiryDate).toBeTruthy()
      })
    })

    test('Expiring documents returns only documents within the next 30 days', ({ given, when, then }) => {
      let response: request.Response
      let soonDocumentId = 0
      let laterDocumentId = 0

      given('documents expiring soon and later than 30 days', async () => {
        const employee = await createEmployee(prefix, { email: `${prefix}.expiring@example.com` })
        const soonDate = new Date()
        soonDate.setDate(soonDate.getDate() + 10)
        const laterDate = new Date()
        laterDate.setDate(laterDate.getDate() + 60)

        const soon = await createDocument(employee.id, `${prefix}-soon`, { expiryDate: soonDate })
        const later = await createDocument(employee.id, `${prefix}-later`, { expiryDate: laterDate })
        soonDocumentId = soon.id
        laterDocumentId = later.id
      })

      when('an admin requests expiring documents', async () => {
        response = await request(app)
          .get('/api/documents/expiring')
          .set('Authorization', authHeader({ id: 31, email: `${prefix}.admin@example.com`, role: 'ADMIN' }))
      })

      then('only the soon-to-expire document is returned', () => {
        expect(response.status).toBe(200)
        expect(response.body.some((doc: any) => doc.id === soonDocumentId)).toBe(true)
        expect(response.body.some((doc: any) => doc.id === laterDocumentId)).toBe(false)
      })
    })

    test('Employee cannot delete another employee\'s document', ({ given, when, then }) => {
      let response: request.Response
      let documentId = 0
      let requesterEmployeeId = 0
      let requesterEmail = ''

      given('a document owned by a different employee', async () => {
        const owner = await createEmployee(`${prefix}-owner`, { email: `${prefix}.owner@example.com` })
        const requester = await createEmployee(`${prefix}-requester`, { email: `${prefix}.requester@example.com` })
        requesterEmployeeId = requester.id
        requesterEmail = requester.email
        await createUser(`${prefix}-requester`, {
          email: requesterEmail,
          employeeId: requesterEmployeeId,
          role: 'USER',
        })
        const upload = ensureUploadFile(`${prefix}-owner`, `${prefix}-owner.pdf`)
        const document = await createDocument(owner.id, `${prefix}-foreign`, { path: upload.publicPath })
        documentId = document.id
      })

      when('a linked employee tries to delete that document', async () => {
        response = await request(app)
          .delete(`/api/documents/${documentId}`)
          .set('Authorization', authHeader({ id: 32, email: requesterEmail, role: 'USER', employeeId: requesterEmployeeId }))
      })

      then('the delete request is rejected with a 403 response', () => {
        expect(response.status).toBe(403)
      })
    })

    test('Employee cannot delete their own document', ({ given, when, then }) => {
      let response: request.Response
      let documentId = 0
      let employeeId = 0
      let email = ''

      given('a document owned by the linked employee', async () => {
        const employee = await createEmployee(prefix, { email: `${prefix}.self@example.com` })
        employeeId = employee.id
        email = employee.email
        await createUser(prefix, { email, employeeId, role: 'USER' })
        const upload = ensureUploadFile(prefix, `${prefix}-self.pdf`)
        const document = await createDocument(employeeId, `${prefix}-self`, { path: upload.publicPath })
        documentId = document.id
      })

      when('the linked employee deletes that document', async () => {
        response = await request(app)
          .delete(`/api/documents/${documentId}`)
          .set('Authorization', authHeader({ id: 33, email, role: 'USER', employeeId }))
      })

      then('the own document delete request is rejected with a 403 response', () => {
        expect(response.status).toBe(403)
      })
    })

    test('Download all returns a ZIP for an employee with documents', ({ given, when, then }) => {
      let response: request.Response
      let employeeId = 0

      given('an employee with a stored document file', async () => {
        const employee = await createEmployee(prefix, { email: `${prefix}.zip@example.com`, firstName: 'Zip', lastName: 'User' })
        employeeId = employee.id
        const upload = ensureUploadFile(prefix, `${prefix}-zip.pdf`)
        await createDocument(employeeId, `${prefix}-zip`, {
          name: `${prefix}-zip.pdf`,
          path: upload.publicPath,
        })
      })

      when('an admin downloads all documents for that employee', async () => {
        response = await request(app)
          .get(`/api/documents/download-all/${employeeId}`)
          .set('Authorization', authHeader({ id: 34, email: `${prefix}.admin@example.com`, role: 'ADMIN' }))
      })

      then('the response is a ZIP download', () => {
        expect(response.status).toBe(200)
        expect(response.headers['content-type']).toContain('application/zip')
        expect(response.headers['content-disposition']).toContain('.zip')
      })
    })

    test('Admin can generate a share link for a stored document', ({ given, when, then }) => {
      let response: request.Response
      let publicResponse: request.Response
      let documentId = 0

      given('an employee with a stored document file', async () => {
        const employee = await createEmployee(prefix, { email: `${prefix}.share@example.com`, firstName: 'Share', lastName: 'User' })
        const upload = ensureUploadFile(prefix, `${prefix}-share.pdf`)
        const document = await createDocument(employee.id, `${prefix}-share`, {
          name: `${prefix}-share.pdf`,
          path: upload.publicPath,
        })
        documentId = document.id
      })

      when('an admin generates a share link for that document', async () => {
        response = await request(app)
          .post(`/api/documents/${documentId}/share-link`)
          .set('Authorization', authHeader({ id: 35, email: `${prefix}.admin@example.com`, role: 'ADMIN' }))

        publicResponse = await request(app)
          .get(`/api/documents/share/${response.body.shareToken}`)
      })

      then('the share link can be used without authentication', () => {
        expect(response.status).toBe(200)
        expect(response.body.shareUrl).toContain('/api/documents/share/')
        expect(publicResponse.status).toBe(200)
        expect(publicResponse.headers['content-disposition']).toContain('.pdf')
      })
    })

    test('Admin can bulk upload payslips for an employee', ({ given, when, then }) => {
      let response: request.Response
      let employeeId = 0
      let uploadPathOne = ''
      let uploadPathTwo = ''

      given('an existing employee record for document upload', async () => {
        const employee = await createEmployee(prefix, { email: `${prefix}.payslip@example.com` })
        employeeId = employee.id
        uploadPathOne = ensureUploadFile(prefix, `${prefix}-payslip-one.pdf`).absolutePath
        uploadPathTwo = ensureUploadFile(prefix, `${prefix}-payslip-two.pdf`).absolutePath
      })

      when('an admin bulk uploads payslips for that employee', async () => {
        response = await request(app)
          .post('/api/documents/upload-payslips')
          .set('Authorization', authHeader({ id: 36, email: `${prefix}.admin@example.com`, role: 'ADMIN' }))
          .field('employeeId', String(employeeId))
          .attach('files', uploadPathOne)
          .attach('files', uploadPathTwo)
      })

      then('the uploaded payslips are stored as shared documents', () => {
        expect(response.status).toBe(200)
        expect(response.body.uploadedCount).toBe(2)
        expect(response.body.documents.every((doc: any) => doc.type === 'PAYSLIP')).toBe(true)
        expect(response.body.documents.every((doc: any) => doc.shareUrl)).toBe(true)
      })
    })
  })
})
