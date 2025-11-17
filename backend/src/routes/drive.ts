import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { requireRole } from '../middleware/roles'
import { getAuthUrl, exchangeCodeAndSave } from '../lib/googleDrive'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'

dotenv.config()

const router = Router()

// Return an auth URL for the frontend to redirect the admin to
router.get('/connect', requireAuth, requireRole('ADMIN'), async (req, res) => {
  // include the raw JWT token in the state so the callback can identify the user
  const authHeader = (req.headers.authorization || '')
  const rawToken = authHeader.replace(/^Bearer\s+/i, '')
  const url = getAuthUrl(rawToken)
  res.json({ url })
})

// OAuth callback - public endpoint. Google will redirect here with `code` and `state`.
// We verify the `state` JWT to get the user id and save tokens on their account.
router.get('/callback', async (req, res) => {
  const code = req.query.code as string | undefined
  const state = req.query.state as string | undefined
  if (!code || !state) return res.status(400).send('missing code or state')
  try {
    const secret = process.env.JWT_SECRET || 'change_me'
    const payload: any = jwt.verify(state, secret)
    const userId = payload.id
    if (!userId) return res.status(400).send('invalid state')
    await exchangeCodeAndSave(code, userId)
    res.send('Google Drive connected successfully. You can close this window.')
  } catch (e: any) {
    res.status(500).send('Failed to exchange code: ' + e.message)
  }
})

export default router
