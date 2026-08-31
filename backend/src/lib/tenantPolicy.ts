import { Response, NextFunction } from 'express'
import { platformPrisma } from '../prismaClient'
import prisma from '../prismaClient'
import { currentTenantId } from './tenantContext'
import { AuthRequest } from '../middleware/auth'

// Paid-feature gate. Features live on Tenant.features as { name: boolean }.
// A missing map means the tenant predates feature flags — allow, never brick.
export function requireFeature(name: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const tenant = await platformPrisma.tenant.findUnique({
        where: { id: currentTenantId() },
        select: { features: true },
      })
      const features = (tenant?.features ?? null) as Record<string, boolean> | null
      if (features && features[name] === false) {
        return res.status(403).json({
          error: 'FEATURE_NOT_AVAILABLE',
          message: `This feature is not included in your plan. Contact hello@onsidehr.co.uk to upgrade.`,
          feature: name,
        })
      }
      next()
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  }
}

/**
 * Seat enforcement: counts employees without an end date (active staff)
 * against Tenant.seatLimit. Throws a SEAT_LIMIT error object for routes to
 * turn into a clear upgrade prompt — never a generic 400.
 */
export async function assertSeatsAvailable(newSeats = 1) {
  const tenant = await platformPrisma.tenant.findUnique({
    where: { id: currentTenantId() },
    select: { seatLimit: true },
  })
  if (!tenant?.seatLimit) return
  const active = await prisma.employee.count({ where: { endDate: null } })
  if (active + newSeats > tenant.seatLimit) {
    const err: any = new Error(
      `Your plan includes ${tenant.seatLimit} employees and you currently have ${active}. ` +
        'Remove leavers or upgrade your plan to add more.',
    )
    err.code = 'SEAT_LIMIT_REACHED'
    err.status = 402
    throw err
  }
}
