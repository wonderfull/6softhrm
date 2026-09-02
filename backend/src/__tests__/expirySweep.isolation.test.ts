import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  jest,
} from '@jest/globals';
import { sweepAllTenantExpiries } from '../lib/expirySweep';
import * as emailService from '../lib/emailService';
import { platformPrisma } from '../prismaClient';

// The expiry sweep used to build one recipient list from every ADMIN/DIRECTOR
// in the database and email all of them about every tenant's visas and
// contracts. This pins the fix: a tenant's admins only ever hear about their
// own workers, and one tenant's failure does not silence the others.

const NOW = new Date('2026-09-30T09:00:00.000Z');
const daysFromNow = (days: number) =>
  new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000);

type Sent = { to: string; subject: string };

describe('expiry sweep tenant isolation', () => {
  let tenantA: number;
  let tenantB: number;
  let suspended: number;
  const sent: Sent[] = [];

  const makeTenant = async (slug: string, status = 'ACTIVE') =>
    platformPrisma.tenant.create({
      data: { slug, name: slug, status },
    });

  const seedTenant = async (
    tenantId: number,
    slug: string,
    visaEndDate: Date,
  ) => {
    await platformPrisma.user.create({
      data: {
        tenantId,
        email: `admin@${slug}.test`,
        password: 'x',
        role: 'ADMIN',
      },
    });
    const employee = await platformPrisma.employee.create({
      data: {
        tenantId,
        firstName: 'Visa',
        lastName: `Holder ${slug}`,
        email: `worker@${slug}.test`,
      },
    });
    await platformPrisma.sponsorship.create({
      data: {
        tenantId,
        employeeId: employee.id,
        visaType: 'Skilled Worker',
        startDate: new Date('2024-01-01'),
        endDate: visaEndDate,
        active: true,
      },
    });
  };

  beforeAll(async () => {
    tenantA = (await makeTenant('expiry-a')).id;
    tenantB = (await makeTenant('expiry-b')).id;
    suspended = (await makeTenant('expiry-suspended', 'SUSPENDED')).id;
    // Overdue visas alert on every run, so the sweep must produce mail for
    // both active tenants without any threshold-timing luck.
    await seedTenant(tenantA, 'expiry-a', daysFromNow(-3));
    await seedTenant(tenantB, 'expiry-b', daysFromNow(-3));
    await seedTenant(suspended, 'expiry-suspended', daysFromNow(-3));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    sent.length = 0;
  });

  afterAll(async () => {
    for (const tenantId of [tenantA, tenantB, suspended]) {
      const where = { tenantId };
      await platformPrisma.auditLog.deleteMany({ where });
      await platformPrisma.sponsorship.deleteMany({ where });
      await platformPrisma.employee.deleteMany({ where });
      await platformPrisma.user.deleteMany({ where });
      await platformPrisma.tenant.delete({ where: { id: tenantId } });
    }
  });

  const captureMail = () =>
    jest
      .spyOn(emailService, 'sendEmail')
      .mockImplementation(async (options) => {
        sent.push({ to: String(options.to), subject: options.subject });
        return true;
      });

  it("emails each tenant's admins about that tenant's workers only", async () => {
    captureMail();
    const result = await sweepAllTenantExpiries(NOW);

    expect(result.errors).toEqual([]);
    expect(result.visaNotifications).toBeGreaterThanOrEqual(4);

    const toA = sent.filter((m) => m.to === 'admin@expiry-a.test');
    const toB = sent.filter((m) => m.to === 'admin@expiry-b.test');
    expect(toA.length).toBeGreaterThan(0);
    expect(toB.length).toBeGreaterThan(0);
    // The only way tenant B's worker could reach A's admin is the old
    // unscoped recipient query.
    expect(toA.every((m) => m.subject.includes('Holder expiry-a'))).toBe(true);
    expect(toB.every((m) => m.subject.includes('Holder expiry-b'))).toBe(true);
  });

  it('skips suspended tenants entirely', async () => {
    captureMail();
    await sweepAllTenantExpiries(NOW);

    expect(sent.some((m) => m.to.endsWith('@expiry-suspended.test'))).toBe(
      false,
    );
  });

  it("records a per-tenant audit row so each tenant's 'last run' is its own", async () => {
    captureMail();
    await sweepAllTenantExpiries(NOW);

    for (const tenantId of [tenantA, tenantB]) {
      const rows = await platformPrisma.auditLog.findMany({
        where: { tenantId, action: 'CRON_EXPIRY_CHECK' },
      });
      expect(rows.length).toBeGreaterThan(0);
    }
    const orphaned = await platformPrisma.auditLog.findMany({
      where: { tenantId: suspended, action: 'CRON_EXPIRY_CHECK' },
    });
    expect(orphaned).toHaveLength(0);
  });

  it('a failing tenant is reported and the rest still get their alerts', async () => {
    captureMail();
    const realVisaExpiry = emailService.EmailTemplates.visaExpiry;
    jest
      .spyOn(emailService.EmailTemplates, 'visaExpiry')
      .mockImplementation((name, ...rest) => {
        if (name.includes('expiry-a')) throw new Error('corrupted template');
        return realVisaExpiry(name, ...rest);
      });

    const result = await sweepAllTenantExpiries(NOW);

    expect(result.errors.some((e) => e.includes(`tenant ${tenantA}`))).toBe(
      true,
    );
    expect(sent.some((m) => m.to === 'admin@expiry-b.test')).toBe(true);
  });
});
