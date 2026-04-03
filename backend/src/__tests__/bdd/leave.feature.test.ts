import path from 'path'
import { afterEach, beforeEach, describe, expect } from '@jest/globals'
import request from 'supertest'
import { defineFeature, loadFeature } from 'jest-cucumber'
import app from '../../app'
import { authHeader, cleanupFixturePrefix, createEmployee, createLeaveRequest, createUser, uniquePrefix } from './helpers/fixtures'

const feature = loadFeature(path.join(__dirname, '../features/leave.feature'))

describe('BDD: leave', () => {
  let prefix: string

  beforeEach(() => {
    prefix = uniquePrefix('leave')
  })

  afterEach(async () => {
    await cleanupFixturePrefix(prefix)
  })

  defineFeature(feature, (test) => {
    test('Linked user submits a leave request', ({ given, when, then }) => {
      let response: request.Response
      let employeeId = 0
      let email = ''

      given('a linked employee user', async () => {
        const employee = await createEmployee(prefix, {
          email: `${prefix}.linked@example.com`,
          firstName: 'Linked',
          lastName: 'Employee',
        })
        employeeId = employee.id
        email = employee.email
        await createUser(prefix, { email, employeeId, role: 'USER', password: 'password123' })
      })

      when('the linked user submits a leave request', async () => {
        response = await request(app)
          .post('/api/leave')
          .set('Authorization', authHeader({ id: 1, email, role: 'USER', employeeId }))
          .send({
            type: 'ANNUAL',
            startDate: '2026-05-01',
            endDate: '2026-05-03',
            reason: 'BDD linked user request',
          })
      })

      then('the leave request is created with PENDING status', () => {
        expect(response.status).toBe(200)
        expect(response.body.status).toBe('PENDING')
        expect(response.body.employeeId).toBe(employeeId)
      })
    })

    test('Unlinked user cannot submit leave', ({ given, when, then }) => {
      let response: request.Response
      let email = ''

      given('an unlinked employee user', async () => {
        email = `${prefix}.unlinked@example.com`
        await createUser(prefix, { email, role: 'USER', password: 'password123' })
      })

      when('the unlinked user submits a leave request', async () => {
        response = await request(app)
          .post('/api/leave')
          .set('Authorization', authHeader({ id: 2, email, role: 'USER' }))
          .send({
            type: 'ANNUAL',
            startDate: '2026-05-01',
            endDate: '2026-05-03',
          })
      })

      then('the leave submission is rejected with a 403 response', () => {
        expect(response.status).toBe(403)
      })
    })

    test('Admin can list all leave requests', ({ given, when, then }) => {
      let response: request.Response

      given('multiple leave requests exist for different employees', async () => {
        const employeeOne = await createEmployee(`${prefix}-one`, { email: `${prefix}.one@example.com` })
        const employeeTwo = await createEmployee(`${prefix}-two`, { email: `${prefix}.two@example.com` })
        await createLeaveRequest(employeeOne.id, { reason: `${prefix}-one-leave` })
        await createLeaveRequest(employeeTwo.id, { reason: `${prefix}-two-leave` })
      })

      when('an admin requests the leave list', async () => {
        response = await request(app)
          .get('/api/leave')
          .set('Authorization', authHeader({ id: 10, email: `${prefix}.admin@example.com`, role: 'ADMIN' }))
      })

      then('the admin receives all matching leave requests', () => {
        expect(response.status).toBe(200)
        expect(Array.isArray(response.body)).toBe(true)
        expect(response.body.filter((item: any) => item.reason?.includes(prefix)).length).toBe(2)
      })
    })

    test('Manager approves a pending request', ({ given, when, then }) => {
      let response: request.Response
      let leaveId = 0

      given('a pending leave request', async () => {
        const employee = await createEmployee(prefix, { email: `${prefix}.approve@example.com` })
        const leave = await createLeaveRequest(employee.id, { reason: `${prefix}-approve`, status: 'PENDING' })
        leaveId = leave.id
      })

      when('a manager approves the request', async () => {
        response = await request(app)
          .put(`/api/leave/${leaveId}/approve`)
          .set('Authorization', authHeader({ id: 20, email: `${prefix}.manager@example.com`, role: 'MANAGER' }))
      })

      then('the leave request status becomes APPROVED', () => {
        expect(response.status).toBe(200)
        expect(response.body.status).toBe('APPROVED')
      })
    })

    test('Manager rejects a pending request', ({ given, when, then }) => {
      let response: request.Response
      let leaveId = 0

      given('a pending leave request', async () => {
        const employee = await createEmployee(prefix, { email: `${prefix}.reject@example.com` })
        const leave = await createLeaveRequest(employee.id, { reason: `${prefix}-reject`, status: 'PENDING' })
        leaveId = leave.id
      })

      when('a manager rejects the request', async () => {
        response = await request(app)
          .put(`/api/leave/${leaveId}/reject`)
          .set('Authorization', authHeader({ id: 21, email: `${prefix}.manager@example.com`, role: 'MANAGER' }))
          .send({ reason: 'Rejected in BDD test' })
      })

      then('the leave request status becomes REJECTED', () => {
        expect(response.status).toBe(200)
        expect(response.body.status).toBe('REJECTED')
      })
    })
  })
})
