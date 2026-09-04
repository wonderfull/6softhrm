import prisma, { platformPrisma } from '../prismaClient';
import { currentTenantId, runWithTenant } from './tenantContext';
import { getStorage } from './storage';
import { sponsorRetentionUntil } from './appendixD';

// Employee data retention. Records are kept for as long as the longest rule
// that applies, then the nightly sweep anonymises the row in place — it stays
// so leave and timesheet aggregates keep adding up, but no longer identifies
// anyone.

const addYears = (date: Date, years: number) => {
  const out = new Date(date);
  out.setUTCFullYear(out.getUTCFullYear() + years);
  return out;
};

/**
 * Latest of the retention periods that apply once employment ends:
 * - six years after leaving — the Limitation Act window for contract claims,
 *   which is why HR files and payroll are conventionally kept this long;
 * - two years after leaving — the Home Office right-to-work retention rule;
 * - one year after the sponsorship ends — Appendix D, which can outlast the
 *   employment when a visa runs on after the worker leaves.
 */
export function computeRetainUntil(
  endDate: Date,
  sponsorships: { endDate: Date | null }[] = [],
): Date {
  const candidates = [addYears(endDate, 6), addYears(endDate, 2)];
  for (const sponsorship of sponsorships) {
    const until = sponsorRetentionUntil(sponsorship.endDate);
    if (until) candidates.push(until);
  }
  return new Date(Math.max(...candidates.map((d) => d.getTime())));
}

const PII_NULLED = {
  middleName: null,
  title: null,
  gender: null,
  ethnicity: null,
  dateOfBirth: null,
  phoneNumber: null,
  workPhone: null,
  niNumber: null,
  address1: null,
  address2: null,
  address3: null,
  townCity: null,
  county: null,
  postcode: null,
  accountName: null,
  bankName: null,
  bankBranch: null,
  accountNumber: null,
  sortCode: null,
  payrollNumber: null,
  taxCode: null,
  passportNumber: null,
  passportCountryOfIssue: null,
  passportExpiryDate: null,
  licenceNumber: null,
  licenceCountryOfIssue: null,
  licenceClass: null,
  licenceExpiryDate: null,
  visaNumber: null,
  visaExpiryDate: null,
  dbsLevel: null,
  dbsCertificateNumber: null,
  dbsIssueDate: null,
  dbsRecheckDate: null,
  emergencyContactName: null,
  emergencyContactPhone: null,
  emergencyContactRelation: null,
  emergencyContactAddress: null,
};

export type AnonymiseResult = {
  employeeId: number;
  documentsDeleted: number;
  sponsorshipsDeleted: number;
  userDeleted: boolean;
};

/**
 * Strip everything that identifies the person and delete what only existed
 * to prove their identity or eligibility. Must run inside a tenant context.
 * The caller is responsible for the audit row (it knows who asked and why).
 */
export async function anonymiseEmployee(
  employeeId: number,
): Promise<AnonymiseResult> {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId },
    include: { documents: true, user: { select: { id: true } } },
  });
  if (!employee) throw new Error('Employee not found');

  const store = getStorage();
  for (const doc of employee.documents) {
    try {
      if (await store.exists(doc.path)) await store.delete(doc.path);
    } catch (err) {
      console.error(`[retention] could not delete file ${doc.path}:`, err);
    }
  }
  const documents = await prisma.document.deleteMany({
    where: { employeeId },
  });
  await prisma.rightToWorkCheck.deleteMany({ where: { employeeId } });
  await prisma.dataConsent.deleteMany({ where: { employeeId } });
  // Evidence and reportable events cascade from the sponsorship.
  const sponsorships = await prisma.sponsorship.deleteMany({
    where: { employeeId },
  });

  let userDeleted = false;
  if (employee.user) {
    await platformPrisma.googleAccount.deleteMany({
      where: { userId: employee.user.id },
    });
    await prisma.user.deleteMany({ where: { id: employee.user.id } });
    userDeleted = true;
  }

  await prisma.employee.updateMany({
    where: { id: employeeId },
    data: {
      ...PII_NULLED,
      firstName: 'Former',
      lastName: `Employee ${employeeId}`,
      email: `erased-${employeeId}@anonymised.invalid`,
      anonymisedAt: new Date(),
    },
  });

  return {
    employeeId,
    documentsDeleted: documents.count,
    sponsorshipsDeleted: sponsorships.count,
    userDeleted,
  };
}

export type RetentionSweepResult = {
  tenantsScanned: number;
  employeesAnonymised: number;
  tenantsPurged: number;
  errors: string[];
};

const TENANT_PURGE_GRACE_DAYS = 30;

/**
 * Nightly: anonymise every employee whose retention date has passed, then
 * hard-delete tenants that have sat soft-deleted for the grace period.
 */
export async function runRetentionSweep(
  now = new Date(),
): Promise<RetentionSweepResult> {
  const result: RetentionSweepResult = {
    tenantsScanned: 0,
    employeesAnonymised: 0,
    tenantsPurged: 0,
    errors: [],
  };

  const tenants = await platformPrisma.tenant.findMany({
    where: { deletedAt: null },
    select: { id: true },
  });

  for (const tenant of tenants) {
    result.tenantsScanned += 1;
    try {
      await runWithTenant({ tenantId: tenant.id }, async () => {
        const due = await prisma.employee.findMany({
          where: { retainUntil: { lte: now }, anonymisedAt: null },
          select: { id: true },
        });
        for (const { id } of due) {
          const outcome = await anonymiseEmployee(id);
          await platformPrisma.auditLog.create({
            data: {
              tenantId: currentTenantId(),
              userId: null,
              userEmail: 'cron@system',
              action: 'ERASURE',
              entity: 'Employee',
              entityId: id,
              details: JSON.stringify({ reason: 'RETENTION_EXPIRED', ...outcome }),
              ipAddress: null,
              userAgent: 'node-cron',
            },
          });
          result.employeesAnonymised += 1;
        }
      });
    } catch (err: any) {
      result.errors.push(`tenant ${tenant.id}: ${err?.message || String(err)}`);
    }
  }

  const cutoff = new Date(
    now.getTime() - TENANT_PURGE_GRACE_DAYS * 24 * 60 * 60 * 1000,
  );
  const expired = await platformPrisma.tenant.findMany({
    where: { deletedAt: { lt: cutoff } },
    select: { id: true, slug: true },
  });
  for (const tenant of expired) {
    try {
      const docs = await platformPrisma.document.findMany({
        where: { tenantId: tenant.id },
        select: { path: true },
      });
      const store = getStorage();
      for (const doc of docs) {
        try {
          if (await store.exists(doc.path)) await store.delete(doc.path);
        } catch (err) {
          console.error(`[retention] could not delete file ${doc.path}:`, err);
        }
      }
      const users = await platformPrisma.user.findMany({
        where: { tenantId: tenant.id },
        select: { id: true },
      });
      await platformPrisma.googleAccount.deleteMany({
        where: { userId: { in: users.map((u) => u.id) } },
      });
      // Every tenant-owned table cascades from Tenant, but MySQL may reach
      // Employee before the tables that reference it without a cascade of
      // their own, so clear those explicitly first.
      const where = { tenantId: tenant.id };
      await platformPrisma.sponsorship.deleteMany({ where });
      await platformPrisma.timesheet.deleteMany({ where });
      await platformPrisma.leaveRequest.deleteMany({ where });
      await platformPrisma.document.deleteMany({ where });
      await platformPrisma.user.deleteMany({ where });
      await platformPrisma.tenant.delete({ where: { id: tenant.id } });
      await platformPrisma.auditLog.create({
        data: {
          tenantId: null,
          userId: null,
          userEmail: 'cron@system',
          action: 'TENANT_PURGED',
          entity: 'Tenant',
          entityId: tenant.id,
          details: JSON.stringify({ slug: tenant.slug, documents: docs.length }),
          ipAddress: null,
          userAgent: 'node-cron',
        },
      });
      result.tenantsPurged += 1;
    } catch (err: any) {
      result.errors.push(`purge tenant ${tenant.id}: ${err?.message || String(err)}`);
    }
  }

  return result;
}
