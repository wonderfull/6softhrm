import { Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { getJwtSecret } from '../lib/authConfig'
import { AuthRequest } from './auth'

// Platform operators authenticate with a separate token kind. A tenant token
// can never pass this check, and a platform token can never pass requireAuth —
// the two authorization worlds do not mix.
export function requirePlatformAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header) return res.status(401).json({ error: 'Missing Authorization header' })

  const token = header.replace('Bearer ', '')
  try {
    const secret = getJwtSecret()
    const payload = jwt.verify(token, secret) as any
    if (!payload || payload.kind !== 'platform' || !payload.platformAdminId) {
      return res.status(401).json({ error: 'Invalid token' })
    }
    req.user = payload
    next()
  } catch (err) {
    if (err instanceof Error && err.message === 'JWT_SECRET is not configured securely') {
      return res.status(500).json({ error: 'Authentication configuration error' })
    }
    return res.status(401).json({ error: 'Invalid token' })
  }
}
