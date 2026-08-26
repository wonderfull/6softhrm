import { Request } from 'express'
import { platformPrisma } from '../prismaClient'
import { tenantStore } from '../lib/tenantContext'

interface AuditRequest extends Request {
  user?: {
    id: number
    email: string
    role: string
    tenantId?: number
  }
}

// Audit writes go through the platform client with an explicit tenantId:
// they must also work before a tenant context exists (failed logins,
// password resets), where tenantId is legitimately null.
export async function createAuditLog(
  userId: number | null,
  userEmail: string | null,
  action: string,
  entity: string,
  entityId: number | null,
  details: string | null,
  req: Request,
  tenantId?: number | null,
) {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress || null
    const userAgent = req.get('user-agent') || null
    const resolvedTenantId = tenantId ?? tenantStore.getStore()?.tenantId ?? null

    await platformPrisma.auditLog.create({
      data: {
        tenantId: resolvedTenantId,
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
