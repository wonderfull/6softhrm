import { AsyncLocalStorage } from 'node:async_hooks'

export type TenantContext = {
  tenantId: number
  userId?: number
  role?: string
}

// Request-scoped tenant context. Entered by requireAuth once the JWT is
// verified; everything downstream in that request (routes, services, email
// helpers, the Prisma extension) inherits it without parameter threading.
export const tenantStore = new AsyncLocalStorage<TenantContext>()

export function currentTenantId(): number {
  const ctx = tenantStore.getStore()
  if (!ctx) {
    throw new Error(
      'TENANT_CONTEXT_MISSING: tenant-scoped work attempted outside a tenant context. ' +
        'Authenticated routes get context from the JWT; platform-level work must use platformPrisma explicitly.',
    )
  }
  return ctx.tenantId
}

export function runWithTenant<T>(ctx: TenantContext, fn: () => T): T {
  return tenantStore.run(ctx, fn)
}
