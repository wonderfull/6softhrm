import path from 'path'
import request from 'supertest'
import { afterEach, beforeEach, expect } from '@jest/globals'
import { defineFeature, loadFeature } from 'jest-cucumber'
import app from '../../app'
import prisma from '../../prismaClient'
import {
  authHeader,
  cleanupFixturePrefix,
  createEmployee,
  createSponsorship,
  uniquePrefix,
} from './helpers/fixtures'

const feature = loadFeature(path.join(__dirname, '../features/sponsorships.feature'))

defineFeature(feature, (test) => {
  let prefix = ''
  let employee: any
  let otherEmployee: any
  let sponsorship: any
  let response: request.Response

  beforeEach(() => {
    prefix = uniquePrefix('sponsorships')
  })

  afterEach(async () => {
    await cleanupFixturePrefix(prefix)
  })

  test('Employee cannot list all sponsorships', ({ given, and, when, then }) => {
    given('another employee has an active sponsorship', async () => {
      otherEmployee = await createEmployee(prefix, { email: `${prefix}.sponsored@example.com` })
      sponsorship = await createSponsorship(otherEmployee.id)
    })

    and('a linked employee is signed in', async () => {
      employee = await createEmployee(prefix, { email: `${prefix}.viewer@example.com` })
    })

    when('the linked employee lists sponsorships', async () => {
      response = await request(app)
        .get('/api/sponsorships')
        .set('Authorization', authHeader({
          id: 10,
          email: employee.email,
          role: 'EMPLOYEE',
          employeeId: employee.id,
        }))
    })

    then('no other employee sponsorships are returned', () => {
      expect(response.status).toBe(200)
      expect(response.body).toEqual([])
    })
  })

  test('Unlinked employee cannot view expiring sponsorships', ({ given, and, when, then }) => {
    given('another employee has a sponsorship expiring soon', async () => {
      otherEmployee = await createEmployee(prefix, { email: `${prefix}.expiring@example.com` })
      sponsorship = await createSponsorship(otherEmployee.id, {
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      })
    })

    and('an unlinked employee user is signed in', () => undefined)

    when('the unlinked employee views expiring sponsorships', async () => {
      response = await request(app)
        .get('/api/sponsorships/expiring')
        .set('Authorization', authHeader({
          id: 11,
          email: `${prefix}.unlinked@example.com`,
          role: 'EMPLOYEE',
        }))
    })

    then('no expiring sponsorships are returned', () => {
      expect(response.status).toBe(200)
      expect(response.body).toEqual([])
    })
  })

  test('Director can manage sponsorships', ({ given, and, when, then }) => {
    given('a director is signed in', () => undefined)

    and('an employee exists', async () => {
      employee = await createEmployee(prefix, { email: `${prefix}.managed@example.com` })
    })

    when('the director creates a sponsorship for that employee', async () => {
      response = await request(app)
        .post('/api/sponsorships')
        .set('Authorization', authHeader({
          id: 12,
          email: `${prefix}.director@example.com`,
          role: 'DIRECTOR',
        }))
        .send({
          employeeId: employee.id,
          visaType: 'Skilled Worker',
          sponsorLicenseNumber: 'BDD-LICENCE',
          startDate: '2026-05-01',
          endDate: '2027-05-01',
        })
    })

    then('the sponsorship is created', () => {
      expect(response.status).toBe(200)
      expect(response.body.employeeId).toBe(employee.id)
    })

    and('an audit log records the sponsorship creation', async () => {
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          userEmail: `${prefix}.director@example.com`,
          action: 'CREATE',
          entity: 'Sponsorship',
        },
      })
      expect(auditLog).not.toBeNull()
    })
  })

  test('Office assistant cannot edit sponsorship core details', ({ given, and, when, then }) => {
    given('an office assistant is signed in', () => undefined)

    and('an employee has an active sponsorship', async () => {
      employee = await createEmployee(prefix, { email: `${prefix}.office-assistant-target@example.com` })
      sponsorship = await createSponsorship(employee.id)
    })

    when('the office assistant updates the sponsorship visa type', async () => {
      response = await request(app)
        .put(`/api/sponsorships/${sponsorship.id}`)
        .set('Authorization', authHeader({
          id: 13,
          email: `${prefix}.assistant@example.com`,
          role: 'OFFICE_ASSISTANT',
        }))
        .send({ visaType: 'Changed Worker' })
    })

    then('the request is forbidden', () => {
      expect(response.status).toBe(403)
    })
  })
})
