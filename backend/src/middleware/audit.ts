import { Request, Response, NextFunction } from 'express'
import prisma from '../prismaClient'

interface AuditRequest extends Request {
  user?: {
    id: number
    email: string
    role: string
  }
}

export async function createAuditLog(
  userId: number | null,
  userEmail: string | null,
  action: string,
  entity: string,
  entityId: number | null,
  details: string | null,
  req: Request
) {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress || null
    const userAgent = req.get('user-agent') || null

    await prisma.auditLog.create({
      data: {
        userId,
        userEmail,
        action,
        entity,
        entityId,
        details,
        ipAddress,
        userAgent
      }
    })
  } catch (error) {
    console.error('Failed to create audit log:', error)
    // Don't throw - audit logging failure shouldn't break the app
  }
}

// Helper function to log from authenticated routes
export async function auditLog(
  req: AuditRequest,
  action: string,
  entity: string,
  entityId?: number,
  details?: any
) {
  const userId = req.user?.id || null
  const userEmail = req.user?.email || null
  const detailsStr = details ? JSON.stringify(details) : null

  await createAuditLog(userId, userEmail, action, entity, entityId || null, detailsStr, req)
}
