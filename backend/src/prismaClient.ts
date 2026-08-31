import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { tenantStore } from './lib/tenantContext';

dotenv.config();

if (
  (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) &&
  process.env.TEST_DATABASE_URL
) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

// Models that carry a tenantId column. Every query against them is scoped to
// the current tenant context — or refused outright when no context exists.
const TENANT_MODELS = new Set([
  'User',
  'Employee',
  'Sponsorship',
  'SponsorshipComplianceEvidence',
  'SponsorshipReportableEvent',
  'Project',
  'Timesheet',
  'LeaveRequest',
  'AbsenceRecord',
  'Document',
  'AuditLog',
  'DataConsent',
]);

// Ops whose `where` accepts arbitrary filters — tenantId is injected in place.
const WHERE_SCOPED_OPS = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'updateMany',
  'deleteMany',
  'count',
  'aggregate',
  'groupBy',
]);

// Ops that require a *unique* `where`, which tenantId cannot be added to.
// Forbidden on tenant models so an id-only lookup can never cross tenants —
// use findFirst / updateMany / deleteMany instead.
const UNIQUE_WHERE_OPS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'update',
  'delete',
  'upsert',
]);

const CREATE_OPS = new Set(['create', 'createMany']);

const base = new PrismaClient();

/**
 * Platform client — NO tenant scoping. Reserved for work that is legitimately
 * cross-tenant or pre-auth: login's email→tenant resolution, the platform
 * admin console, cron sweeps, seeds and migrations. Every use is a
 * deliberate, greppable escape hatch; route handlers must not import it.
 */
export const platformPrisma = base;

const prisma = base.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (!model || !TENANT_MODELS.has(model)) return query(args);

        const ctx = tenantStore.getStore();
        if (!ctx) {
          throw new Error(
            `TENANT_CONTEXT_MISSING: ${model}.${operation} ran outside a tenant context. ` +
              'Authenticated routes get context from the JWT; platform-level work must use platformPrisma explicitly.',
          );
        }
        const tenantId = ctx.tenantId;
        const scopedArgs: any = args ?? {};

        if (UNIQUE_WHERE_OPS.has(operation)) {
          throw new Error(
            `TENANT_UNSAFE_OPERATION: ${model}.${operation} takes a unique \`where\` that cannot be tenant-scoped. ` +
              'Use findFirst / updateMany / deleteMany with an explicit where instead.',
          );
        }

        if (WHERE_SCOPED_OPS.has(operation)) {
          scopedArgs.where = { ...(scopedArgs.where ?? {}), tenantId };
          // Backstop against mass assignment: update data must never carry a
          // foreign tenantId (e.g. smuggled in via a raw req.body spread).
          if (
            scopedArgs.data &&
            scopedArgs.data.tenantId !== undefined &&
            scopedArgs.data.tenantId !== tenantId
          ) {
            throw new Error(
              `TENANT_MISMATCH: ${model}.${operation} attempted to set tenantId=${scopedArgs.data.tenantId} inside tenant ${tenantId}'s context.`,
            );
          }
        }

        if (CREATE_OPS.has(operation)) {
          const stamp = (row: any) => {
            if (row.tenantId !== undefined && row.tenantId !== tenantId) {
              throw new Error(
                `TENANT_MISMATCH: ${model}.${operation} received data.tenantId=${row.tenantId} inside tenant ${tenantId}'s context.`,
              );
            }
            return { ...row, tenantId };
          };
          scopedArgs.data = Array.isArray(scopedArgs.data)
            ? scopedArgs.data.map(stamp)
            : stamp(scopedArgs.data);
        }

        return query(scopedArgs);
      },
    },
  },
});

export default prisma;
