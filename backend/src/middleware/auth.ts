import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'
import { getJwtSecret } from '../lib/authConfig'
import { tenantStore } from '../lib/tenantContext'

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
    const payload = jwt.verify(token, secret) as any

    // Tokens minted before multi-tenancy carry no tenantId; force a fresh
    // login rather than running tenant-scoped work without a tenant.
    if (!payload || typeof payload !== 'object' || !payload.tenantId) {
      return res.status(401).json({ error: 'Session expired — please log in again' })
    }

    req.user = payload

    // Enter the tenant context for everything downstream in this request.
    // The Prisma extension refuses tenant-model queries outside this scope.
    return tenantStore.run(
      { tenantId: payload.tenantId, userId: payload.id, role: payload.role },
      () => next(),
    )
  } catch (err) {
    if (err instanceof Error && err.message === 'JWT_SECRET is not configured securely') {
      return res.status(500).json({ error: 'Authentication configuration error' })
    }
    return res.status(401).json({ error: 'Invalid token' })
  }
}

// Multer (busboy) resumes the request from raw socket events, which drops the
// AsyncLocalStorage context entered in requireAuth. Mount this AFTER any
// multer middleware to re-enter the tenant context for the handler.
export function rebindTenant(req: AuthRequest, res: Response, next: NextFunction) {
  const payload = req.user
  if (!payload || !payload.tenantId) {
    return res.status(401).json({ error: 'Session expired — please log in again' })
  }
  return tenantStore.run(
    { tenantId: payload.tenantId, userId: payload.id, role: payload.role },
    () => next(),
  )
}
