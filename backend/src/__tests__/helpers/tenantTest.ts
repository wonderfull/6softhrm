import { expect } from '@jest/globals'
import jwt from 'jsonwebtoken'
import prismaExtended, { platformPrisma } from '../../prismaClient'
import { runWithTenant } from '../../lib/tenantContext'

let cachedTenantId: number | null = null

// Called from setup.ts before each suite: creates (or reuses) a tenant unique
// to the suite so its data and tokens are all scoped consistently.
export async function initTestTenant(): Promise<number> {
  const testPath = expect.getState().testPath || 'suite'
  const slug = (
    'test-' +
    testPath
      .split('/')
      .pop()!
      .replace(/\.test\.ts$/, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
  ).toLowerCase()
  const tenant = await platformPrisma.tenant.upsert({
    where: { slug },
    update: {},
    create: {
      slug,
      name: `Test ${slug}`,
      status: 'ACTIVE',
      plan: 'CORE_PLUS_COMPLIANCE',
      features: { compliance: true },
    },
  })
  cachedTenantId = tenant.id
  return tenant.id
}

export function testTenantId(): number {
  if (!cachedTenantId) {
    throw new Error('Test tenant not initialised — is setup.ts running?')
  }
  return cachedTenantId
}

// jwt.sign replacement for tests: injects the suite tenant's id so tokens
// pass requireAuth's tenant check. Explicit tenantId in payload wins (for
// cross-tenant attack tests).
export function signTestToken(payload: Record<string, unknown>): string {
  return jwt.sign(
    { tenantId: testTenantId(), ...payload },
    process.env.JWT_SECRET || 'test-secret-key',
  )
}

function inTenant<T>(fn: () => T): T {
  return runWithTenant({ tenantId: testTenantId() }, fn)
}

// Prisma facade for test setup/teardown: every call runs inside the suite's
// tenant context, so creates are auto-stamped with tenantId and reads are
// auto-scoped. Typed loosely on purpose — test fixtures predate the tenant
// column and the runtime extension guarantees correctness.
export const testPrisma: any = new Proxy({} as any, {
  get(_target, prop: string) {
    const client: any = prismaExtended
    const value = client[prop]
    // Prisma promises are lazy — they execute on await, not on creation — so
    // the await must happen INSIDE the tenant context or the extension sees
    // no store.
    if (prop === '$transaction') {
      return (arg: any, opts?: any) => inTenant(async () => await client.$transaction(arg, opts))
    }
    if (value && typeof value === 'object') {
      return new Proxy(value, {
        get(model: any, method: string) {
          const fn = model[method]
          if (typeof fn !== 'function') return fn
          // The extension forbids unique-where ops on tenant models, but test
          // fixtures use natural Prisma idioms — translate them to the
          // tenant-safe equivalents here instead of rewriting every test.
          return (...args: any[]) =>
            inTenant(async () => {
              const arg = args[0] ?? {}
              if (method === 'findUnique') return model.findFirst(arg)
              if (method === 'findUniqueOrThrow') return model.findFirstOrThrow(arg)
              if (method === 'update') {
                const { where, data, ...rest } = arg
                const updated = await model.updateMany({ where, data })
                if (updated.count === 0) throw new Error('Record to update not found.')
                return model.findFirst({ where, ...rest })
              }
              if (method === 'delete') {
                const { where, ...rest } = arg
                const row = await model.findFirst({ where, ...rest })
                if (!row) throw new Error('Record to delete does not exist.')
                await model.deleteMany({ where })
                return row
              }
              if (method === 'upsert') {
                const { where, update, create, ...rest } = arg
                const existing = await model.findFirst({ where })
                if (existing) {
                  await model.updateMany({ where, data: update })
                  return model.findFirst({ where, ...rest })
                }
                return model.create({ data: create, ...rest })
              }
              return await fn.apply(model, args)
            })
        },
      })
    }
    return typeof value === 'function' ? value.bind(client) : value
  },
})
