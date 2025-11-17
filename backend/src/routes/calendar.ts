import { Router } from 'express'
import { requireAuth } from '../middleware/auth'

const router = Router()

// Placeholder: return a URL to start OAuth flow for Google (you must register an app and replace values)
router.get('/connect/google', requireAuth, (req, res) => {
  const redirect = 'https://accounts.google.com/o/oauth2/v2/auth?client_id=YOUR_CLIENT_ID&redirect_uri=YOUR_CALLBACK&response_type=code&scope=https://www.googleapis.com/auth/calendar'
  res.json({ url: redirect })
})

// OAuth callback stub - in real integration exchange code for tokens and store them
router.get('/callback/google', (req, res) => {
  const { code } = req.query
  if (!code) return res.status(400).send('missing code')
  // TODO: exchange code for tokens server-side
  res.send('Received code. Implement token exchange in backend with Google OAuth client.')
})

export default router
