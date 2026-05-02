import path from 'path'
import { afterEach, beforeEach, describe, expect } from '@jest/globals'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { defineFeature, loadFeature } from 'jest-cucumber'
import app from '../../app'
import { authHeader, cleanupFixturePrefix, createUser, uniquePrefix } from './helpers/fixtures'

const feature = loadFeature(path.join(__dirname, '../features/auth.feature'))

describe('BDD: auth', () => {
  let prefix: string

  beforeEach(() => {
    prefix = uniquePrefix('auth')
  })

  afterEach(async () => {
    await cleanupFixturePrefix(prefix)
  })

  defineFeature(feature, (test) => {
    test('Unauthenticated user listing is rejected', ({ when, then }) => {
      let response: request.Response

      when('an unauthenticated client requests the user list', async () => {
        response = await request(app).get('/api/auth/users')
      })

      then('the request is rejected with a 401 response', () => {
        expect(response.status).toBe(401)
      })
    })

    test('Public registration cannot self-assign admin role', ({ given, when, then }) => {
      let response: request.Response
      let email = ''

      given('a public registration payload requesting the ADMIN role', () => {
        email = `${prefix}@example.com`
      })

      when('the registration is submitted', async () => {
        response = await request(app).post('/api/auth/register').send({
          email,
          password: 'password123',
          name: prefix,
          role: 'ADMIN',
        })
      })

      then('the created account is stored with the EMPLOYEE role', () => {
        expect(response.status).toBe(200)
        expect(response.body.email).toBe(email)
        expect(response.body.role).toBe('EMPLOYEE')
      })
    })

    test('Valid login returns a JWT and user identity', ({ given, when, then, and }) => {
      let response: request.Response
      let email = ''

      given('an existing registered user with a known password', async () => {
        email = `${prefix}.login@example.com`
        await createUser(prefix, {
          email,
          password: 'password123',
          name: `${prefix} Login User`,
          role: 'USER',
        })
      })

      when('the user logs in with valid credentials', async () => {
        response = await request(app).post('/api/auth/login').send({ email, password: 'password123' })
      })

      then('the login response contains a JWT token', () => {
        expect(response.status).toBe(200)
        expect(response.body.token).toEqual(expect.any(String))
      })

      and("the login response contains the user's email", () => {
        expect(response.body.user.email).toBe(email)
      })
    })

    test('Invalid password is rejected', ({ given, when, then }) => {
      let response: request.Response
      let email = ''

      given('an existing registered user with a known password', async () => {
        email = `${prefix}.invalid@example.com`
        await createUser(prefix, {
          email,
          password: 'password123',
          name: `${prefix} Invalid Login User`,
        })
      })

      when('the user logs in with an invalid password', async () => {
        response = await request(app).post('/api/auth/login').send({ email, password: 'wrong-password' })
      })

      then('the request is rejected with a 401 response', () => {
        expect(response.status).toBe(401)
      })
    })

    test('Password reset token can be generated and redeemed', ({ given, when, and, then }) => {
      let resetResponse: request.Response
      let loginResponse: request.Response
      let email = ''
      let resetToken = ''
      let userId = 0

      given('an existing registered user with a known password', async () => {
        email = `${prefix}.reset@example.com`
        const user = await createUser(prefix, {
          email,
          password: 'password123',
          name: `${prefix} Reset User`,
        })
        userId = user.id
      })

      when('the user requests a password reset token', async () => {
        resetResponse = await request(app).post('/api/auth/forgot-password').send({ email })
      })

      and('the user resets the password with the generated token', async () => {
        expect(resetResponse.status).toBe(200)
        expect(resetResponse.body.resetToken).toBeUndefined()
        expect(resetResponse.body.resetLink).toBeUndefined()

        resetToken = jwt.sign(
          { id: userId, email, type: 'password-reset' },
          process.env.JWT_SECRET || 'test-secret-key',
          { expiresIn: '1h' }
        )

        await request(app).post('/api/auth/reset-password').send({
          token: resetToken,
          newPassword: 'new-password123',
        })
      })

      then('the user can log in with the new password', async () => {
        loginResponse = await request(app).post('/api/auth/login').send({
          email,
          password: 'new-password123',
        })

        expect(loginResponse.status).toBe(200)
        expect(loginResponse.body.user.email).toBe(email)
      })
    })

    test('Admin can trigger a reset link for an employee', ({ given, when, then }) => {
      let response: request.Response
      let userId = 0

      given('an existing registered user with a known password', async () => {
        const user = await createUser(prefix, {
          email: `${prefix}.adminreset@example.com`,
          password: 'password123',
          name: `${prefix} Admin Reset User`,
        })
        userId = user.id
      })

      when('an admin generates a password reset link for that user', async () => {
        response = await request(app)
          .post(`/api/auth/users/${userId}/reset-link`)
          .set('Authorization', authHeader({ id: 60, email: `${prefix}.admin@example.com`, role: 'ADMIN' }))
      })

      then('the response confirms the reset link was handled without exposing it', () => {
        expect(response.status).toBe(200)
        expect(response.body.resetLink).toBeUndefined()
        expect(response.body.resetToken).toBeUndefined()
        expect(response.body.message).toEqual(expect.any(String))
      })
    })

    test('Admin can set a temporary password for an employee', ({ given, when, then }) => {
      let response: request.Response
      let loginResponse: request.Response
      let email = ''
      let userId = 0

      given('an existing registered user with a known password', async () => {
        email = `${prefix}.temppassword@example.com`
        const user = await createUser(prefix, {
          email,
          password: 'password123',
          name: `${prefix} Temp Password User`,
        })
        userId = user.id
      })

      when('an admin directly resets that user\'s password', async () => {
        response = await request(app)
          .post(`/api/auth/users/${userId}/reset-password`)
          .set('Authorization', authHeader({ id: 61, email: `${prefix}.admin@example.com`, role: 'ADMIN' }))
          .send({ newPassword: 'temporary-password123' })
      })

      then('the user can log in with the temporary password', async () => {
        expect(response.status).toBe(200)

        loginResponse = await request(app).post('/api/auth/login').send({
          email,
          password: 'temporary-password123',
        })

        expect(loginResponse.status).toBe(200)
        expect(loginResponse.body.user.email).toBe(email)
      })
    })

    test('Invalid reset token is rejected', ({ when, then }) => {
      let response: request.Response

      when('a password reset is attempted with an invalid token', async () => {
        response = await request(app).post('/api/auth/reset-password').send({
          token: 'not-a-valid-token',
          newPassword: 'new-password123',
        })
      })

      then('the request is rejected with a 400 response', () => {
        expect(response.status).toBe(400)
      })
    })
  })
})
