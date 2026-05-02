import { Response, NextFunction } from 'express'
import { AuthRequest } from './auth'
import { normalizeRole } from '../lib/roles'

export function requireRole(...roles: string[]) {
  const allowedRoles = roles.map(normalizeRole)

  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const user = req.user
    if (!user) return res.status(401).json({ error: 'unauthorized' })

    const normalizedRole = normalizeRole(user.role)
    if (!allowedRoles.includes(normalizedRole)) {
      return res.status(403).json({ error: 'forbidden' })
    }

    req.user = { ...user, role: normalizedRole }
    next()
  }
}
