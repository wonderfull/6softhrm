import { Response, NextFunction } from 'express'
import { AuthRequest } from './auth'

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const user = req.user
    if (!user) return res.status(401).json({ error: 'unauthorized' })
    if (!roles.includes(user.role)) return res.status(403).json({ error: 'forbidden' })
    next()
  }
}
