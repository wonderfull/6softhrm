import path from 'path'
import { afterEach, beforeEach, describe, expect } from '@jest/globals'
import request from 'supertest'
import { defineFeature, loadFeature } from 'jest-cucumber'
import app from '../../app'
import { authHeader, cleanupFixturePrefix, createEmployee, createSponsorship, uniquePrefix } from './helpers/fixtures'

const feature = loadFeature(path.join(__dirname, '../features/notifications.feature'))

describe('BDD: notifications', () => {
  let prefix: string

  beforeEach(() => {
    prefix = uniquePrefix('notifications')
  })

  afterEach(async () => {
    await cleanupFixturePrefix(prefix)
  })

  defineFeature(feature, (test) => {
    test('Manager can trigger expiry checks', ({ when, then }) => {
      let response: request.Response

      when('a manager triggers an expiry check', async () => {
        response = await request(app)
          .post('/api/notifications/check-expiries')
          .set('Authorization', authHeader({ id: 50, email: `${prefix}.manager@example.com`, role: 'MANAGER' }))
      })

      then('the expiry check succeeds', () => {
        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
      })
    })

    test('User cannot trigger expiry checks', ({ when, then }) => {
      let response: request.Response

      when('a regular user triggers an expiry check', async () => {
        response = await request(app)
          .post('/api/notifications/check-expiries')
          .set('Authorization', authHeader({ id: 51, email: `${prefix}.user@example.com`, role: 'USER' }))
      })

      then('the request is rejected with a 403 response', () => {
        expect(response.status).toBe(403)
      })
    })

    test('Upcoming expiries respects the days parameter', ({ given, when, then }) => {
      let response: request.Response

      given('upcoming expiry records within and outside the requested window', async () => {
        const nearEmployee = await createEmployee(`${prefix}-near`, {
          email: `${prefix}.near@example.com`,
          firstName: 'Near',
          lastName: 'Expiry',
          endDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        })
        const farEmployee = await createEmployee(`${prefix}-far`, {
          email: `${prefix}.far@example.com`,
          firstName: 'Far',
          lastName: 'Expiry',
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        })

        await createSponsorship(nearEmployee.id, {
          endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
          visaType: `${prefix}-Near Visa`,
        })
        await createSponsorship(farEmployee.id, {
          endDate: new Date(Date.now() + 80 * 24 * 60 * 60 * 1000),
          visaType: `${prefix}-Far Visa`,
        })
      })

      when('an admin requests upcoming expiries for 30 days', async () => {
        response = await request(app)
          .get('/api/notifications/upcoming-expiries')
          .query({ days: 30 })
          .set('Authorization', authHeader({ id: 52, email: `${prefix}.admin@example.com`, role: 'ADMIN' }))
      })

      then('only records within 30 days are returned', () => {
        expect(response.status).toBe(200)
        expect(response.body.contractExpiries.some((item: any) => item.employeeName.includes('Near Expiry'))).toBe(true)
        expect(response.body.contractExpiries.some((item: any) => item.employeeName.includes('Far Expiry'))).toBe(false)
        expect(response.body.visaExpiries.some((item: any) => item.visaType === `${prefix}-Near Visa`)).toBe(true)
        expect(response.body.visaExpiries.some((item: any) => item.visaType === `${prefix}-Far Visa`)).toBe(false)
      })
    })
  })
})
