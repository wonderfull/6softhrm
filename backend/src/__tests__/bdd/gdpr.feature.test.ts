import path from 'path'
import { afterEach, beforeEach, describe, expect } from '@jest/globals'
import request from 'supertest'
import { defineFeature, loadFeature } from 'jest-cucumber'
import app from '../../app'
import prisma from '../../prismaClient'
import { authHeader, cleanupFixturePrefix, createDocument, createEmployee, createProject, createTimesheet, createUser, uniquePrefix } from './helpers/fixtures'

const feature = loadFeature(path.join(__dirname, '../features/gdpr.feature'))

describe('BDD: gdpr', () => {
  let prefix: string

  beforeEach(() => {
    prefix = uniquePrefix('gdpr')
  })

  afterEach(async () => {
    await cleanupFixturePrefix(prefix)
  })

  defineFeature(feature, (test) => {
    test('Admin can retrieve audit logs', ({ given, when, then }) => {
      let response: request.Response

      given('an existing audit log entry', async () => {
        await prisma.auditLog.create({
          data: {
            userEmail: `${prefix}.admin@example.com`,
            action: 'LOGIN_SUCCESS',
            entity: 'User',
            details: JSON.stringify({ prefix }),
          },
        })
      })

      when('an admin requests audit logs filtered by action', async () => {
        response = await request(app)
          .get('/api/gdpr/audit-logs')
          .query({ action: 'LOGIN_SUCCESS' })
          .set('Authorization', authHeader({ id: 40, email: `${prefix}.admin@example.com`, role: 'ADMIN' }))
      })

      then('the audit logs response includes the matching entry', () => {
        expect(response.status).toBe(200)
        expect(response.body.logs.some((log: any) => log.details?.includes(prefix))).toBe(true)
      })
    })

    test('Employee can request their own subject access data', ({ given, when, then }) => {
      let response: request.Response
      let employeeId = 0
      let email = ''

      given('a linked employee user with personal records', async () => {
        const employee = await createEmployee(prefix, { email: `${prefix}.selfsar@example.com` })
        employeeId = employee.id
        email = employee.email
        await createUser(prefix, { email, employeeId, role: 'USER' })
        const project = await createProject(prefix)
        await createTimesheet(employeeId, project.id)
        await createDocument(employeeId, prefix, { expiryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000) })
      })

      when('the employee requests their own subject access data', async () => {
        response = await request(app)
          .get(`/api/gdpr/subject-access-request/${employeeId}`)
          .set('Authorization', authHeader({ id: 41, email, role: 'USER', employeeId }))
      })

      then('the export contains the employee email', () => {
        expect(response.status).toBe(200)
        expect(response.body.employee.email).toBe(email)
      })
    })

    test('Employee cannot request another employee\'s subject access data', ({ given, when, then }) => {
      let response: request.Response
      let requesterId = 0
      let requesterEmail = ''
      let targetEmployeeId = 0

      given('two different linked employee users', async () => {
        const requester = await createEmployee(`${prefix}-requester`, { email: `${prefix}.requester@example.com` })
        const target = await createEmployee(`${prefix}-target`, { email: `${prefix}.target@example.com` })
        requesterId = requester.id
        requesterEmail = requester.email
        targetEmployeeId = target.id
        await createUser(`${prefix}-requester`, { email: requesterEmail, employeeId: requesterId, role: 'USER' })
        await createUser(`${prefix}-target`, { email: target.email, employeeId: target.id, role: 'USER' })
      })

      when("the first employee requests the second employee's subject access data", async () => {
        response = await request(app)
          .get(`/api/gdpr/subject-access-request/${targetEmployeeId}`)
          .set('Authorization', authHeader({ id: 42, email: requesterEmail, role: 'USER', employeeId: requesterId }))
      })

      then('the request is rejected with a 403 response', () => {
        expect(response.status).toBe(403)
      })
    })

    test('Employee can record consent and view consent history', ({ given, when, and, then }) => {
      let createConsentResponse: request.Response
      let historyResponse: request.Response
      let employeeId = 0
      let email = ''

      given('a linked employee user with no prior consent records', async () => {
        const employee = await createEmployee(prefix, { email: `${prefix}.consent@example.com` })
        employeeId = employee.id
        email = employee.email
        await createUser(prefix, { email, employeeId, role: 'USER' })
      })

      when('the employee records a consent choice', async () => {
        createConsentResponse = await request(app)
          .post('/api/gdpr/consent')
          .set('Authorization', authHeader({ id: 43, email, role: 'USER', employeeId }))
          .send({
            employeeId,
            consentType: `${prefix}-photo_usage`,
            consentGiven: true,
            version: '1.0',
          })
      })

      and('the employee requests their consent history', async () => {
        historyResponse = await request(app)
          .get(`/api/gdpr/consent/${employeeId}`)
          .set('Authorization', authHeader({ id: 43, email, role: 'USER', employeeId }))
      })

      then('the consent history contains the recorded consent type', () => {
        expect(createConsentResponse.status).toBe(200)
        expect(historyResponse.status).toBe(200)
        expect(historyResponse.body.some((consent: any) => consent.consentType === `${prefix}-photo_usage`)).toBe(true)
      })
    })
  })
})
