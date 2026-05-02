import path from 'path'
import request from 'supertest'
import { afterEach, beforeEach, expect } from '@jest/globals'
import { defineFeature, loadFeature } from 'jest-cucumber'
import app from '../../app'
import prisma from '../../prismaClient'
import {
  authHeader,
  cleanupFixturePrefix,
  createDocument,
  createEmployee,
  createSponsorship,
  uniquePrefix,
} from './helpers/fixtures'

const feature = loadFeature(path.join(__dirname, '../features/sponsorship-compliance.feature'))

const requiredRightToWorkEvidence = {
  evidenceType: 'RIGHT_TO_WORK_CHECK',
  notes: 'Online right-to-work share code checked',
  verifiedAt: '2026-05-01T09:30:00.000Z',
}

defineFeature(feature, (test) => {
  let prefix = ''
  let employee: any
  let otherEmployee: any
  let sponsorship: any
  let document: any
  let otherDocument: any
  let response: request.Response

  beforeEach(() => {
    prefix = uniquePrefix('sponsorship-compliance')
  })

  afterEach(async () => {
    await cleanupFixturePrefix(prefix)
  })

  async function createSponsoredEmployee() {
    employee = await createEmployee(prefix, { email: `${prefix}.sponsored@example.com` })
    sponsorship = await createSponsorship(employee.id)
  }

  function roleHeader(role: string, id = 50) {
    return authHeader({
      id,
      email: `${prefix}.${role.toLowerCase()}@example.com`,
      role,
    })
  }

  test('HR support roles can view a compliance pack', ({ given, when, then }) => {
    given('a sponsored employee has no compliance evidence', createSponsoredEmployee)

    when(/^a (.*) views the sponsorship compliance pack$/, async (role: string) => {
      response = await request(app)
        .get(`/api/sponsorships/${sponsorship.id}/compliance`)
        .set('Authorization', roleHeader(role))
    })

    then('the compliance pack is returned with five missing evidence rows', () => {
      expect(response.status).toBe(200)
      expect(response.body.sponsorship.id).toBe(sponsorship.id)
      expect(response.body.employee).toEqual({
        id: employee.id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email,
        jobTitle: employee.jobTitle,
      })
      expect(response.body.requiredEvidence).toHaveLength(5)
      expect(response.body.requiredEvidence.every((row: any) => row.status === 'MISSING')).toBe(true)
      expect(response.body.existingEvidence).toEqual([])
      expect(response.body.missingCount).toBe(5)
    })
  })

  test("Employee cannot view another worker's compliance pack", ({ given, and, when, then }) => {
    given('a sponsored employee has no compliance evidence', createSponsoredEmployee)

    and('a different linked employee is signed in', async () => {
      otherEmployee = await createEmployee(prefix, { email: `${prefix}.viewer@example.com` })
    })

    when('the linked employee views the sponsorship compliance pack', async () => {
      response = await request(app)
        .get(`/api/sponsorships/${sponsorship.id}/compliance`)
        .set('Authorization', authHeader({
          id: 51,
          email: otherEmployee.email,
          role: 'EMPLOYEE',
          employeeId: otherEmployee.id,
        }))
    })

    then('the compliance pack is not found', () => {
      expect(response.status).toBe(404)
    })
  })

  test('Office assistant can add compliance evidence but cannot edit core sponsorship', ({ given, when, then, and }) => {
    given('a sponsored employee has a matching document', async () => {
      await createSponsoredEmployee()
      document = await createDocument(employee.id, prefix, { type: 'RIGHT_TO_WORK' })
    })

    when('the office assistant adds right-to-work compliance evidence', async () => {
      response = await request(app)
        .post(`/api/sponsorships/${sponsorship.id}/compliance/evidence`)
        .set('Authorization', roleHeader('OFFICE_ASSISTANT', 52))
        .send({ ...requiredRightToWorkEvidence, documentId: document.id })
    })

    then('the evidence is recorded in the compliance pack', () => {
      expect(response.status).toBe(201)
      expect(response.body.evidenceType).toBe('RIGHT_TO_WORK_CHECK')
      expect(response.body.documentId).toBe(document.id)
    })

    and('an audit log records the compliance evidence creation', async () => {
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          userEmail: `${prefix}.office_assistant@example.com`,
          action: 'CREATE',
          entity: 'SponsorshipComplianceEvidence',
        },
      })
      expect(auditLog).not.toBeNull()
    })

    when('the office assistant updates the sponsorship visa type', async () => {
      response = await request(app)
        .put(`/api/sponsorships/${sponsorship.id}`)
        .set('Authorization', roleHeader('OFFICE_ASSISTANT', 52))
        .send({ visaType: 'Changed Worker' })
    })

    then('the core sponsorship update is forbidden', () => {
      expect(response.status).toBe(403)
    })
  })

  test('Document evidence must belong to the sponsored employee', ({ given, and, when, then }) => {
    given('a sponsored employee has no compliance evidence', createSponsoredEmployee)

    and('another employee has a document', async () => {
      otherEmployee = await createEmployee(prefix, { email: `${prefix}.document-owner@example.com` })
      otherDocument = await createDocument(otherEmployee.id, prefix, { type: 'RIGHT_TO_WORK' })
    })

    when("the office assistant adds compliance evidence using the other employee's document", async () => {
      response = await request(app)
        .post(`/api/sponsorships/${sponsorship.id}/compliance/evidence`)
        .set('Authorization', roleHeader('OFFICE_ASSISTANT', 53))
        .send({ ...requiredRightToWorkEvidence, documentId: otherDocument.id })
    })

    then('the evidence request is rejected', () => {
      expect(response.status).toBe(400)
      expect(response.body.error).toBe('Document must belong to the sponsored employee')
    })
  })

  test('Compliance pack shows missing evidence until evidence exists', ({ given, when, then, and }) => {
    given('a sponsored employee has a matching document', async () => {
      await createSponsoredEmployee()
      document = await createDocument(employee.id, prefix, { type: 'RIGHT_TO_WORK' })
    })

    when('an admin views the sponsorship compliance pack', async () => {
      response = await request(app)
        .get(`/api/sponsorships/${sponsorship.id}/compliance`)
        .set('Authorization', roleHeader('ADMIN', 54))
    })

    then('right-to-work evidence is missing', () => {
      expect(response.status).toBe(200)
      const row = response.body.requiredEvidence.find((item: any) => item.key === 'RIGHT_TO_WORK_CHECK')
      expect(row.status).toBe('MISSING')
      expect(response.body.missingCount).toBe(5)
    })

    when('the office assistant adds right-to-work compliance evidence', async () => {
      response = await request(app)
        .post(`/api/sponsorships/${sponsorship.id}/compliance/evidence`)
        .set('Authorization', roleHeader('OFFICE_ASSISTANT', 55))
        .send({ ...requiredRightToWorkEvidence, documentId: document.id })
    })

    and('an admin views the sponsorship compliance pack', async () => {
      response = await request(app)
        .get(`/api/sponsorships/${sponsorship.id}/compliance`)
        .set('Authorization', roleHeader('ADMIN', 54))
    })

    then('right-to-work evidence is complete', () => {
      expect(response.status).toBe(200)
      const row = response.body.requiredEvidence.find((item: any) => item.key === 'RIGHT_TO_WORK_CHECK')
      expect(row.status).toBe('COMPLETE')
      expect(row.evidence).toEqual(expect.objectContaining({
        evidenceType: 'RIGHT_TO_WORK_CHECK',
        documentId: document.id,
      }))
      expect(response.body.missingCount).toBe(4)
    })
  })
})
