import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'
import { getJwtSecret } from '../lib/authConfig'

dotenv.config()

export interface AuthRequest extends Request {
  user?: any
  headers: {
    authorization?: string
    [key: string]: string | string[] | undefined
  }
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header) return res.status(401).json({ error: 'Missing Authorization header' })

  const token = header.replace('Bearer ', '')
  try {
    const secret = getJwtSecret()
    const payload = jwt.verify(token, secret)
    req.user = payload
    next()
  } catch (err) {
    if (err instanceof Error && err.message === 'JWT_SECRET is not configured securely') {
      return res.status(500).json({ error: 'Authentication configuration error' })
    }
    return res.status(401).json({ error: 'Invalid token' })
  }
}
