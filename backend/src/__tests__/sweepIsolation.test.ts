import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  jest,
} from '@jest/globals';
import { detectUnauthorisedAbsence } from '../lib/absenceDetection';
import { reconcileSalaries } from '../lib/salarySweep';
import * as tenantSettings from '../lib/tenantSettings';
import { DEFAULT_WORKING_DAY_CONFIG } from '../lib/workingDays';
import { platformPrisma } from '../prismaClient';

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

// Both sweeps wrap each tenant in try/catch so one tenant's broken data
// cannot stop another tenant's Home Office report from being raised. That is
// the single most important property of a multi-tenant compliance sweep —
// and until now nothing proved it: a regression to a plain loop would have
// passed every existing test.

const WEEKDAYS = [
  '2026-09-07',
  '2026-09-08',
  '2026-09-09',
  '2026-09-10',
  '2026-09-11',
  '2026-09-14',
  '2026-09-15',
  '2026-09-16',
  '2026-09-17',
  '2026-09-18',
];
const NOW = d('2026-09-30');

describe('sweep isolation between tenants', () => {
  let brokenTenantId: number;
  let healthyTenantId: number;
  let healthySponsorshipId: number;

  const makeTenant = async (slug: string) =>
    platformPrisma.tenant.create({
      data: {
        slug,
        name: slug,
        status: 'ACTIVE',
        features: { compliance: true },
      },
    });

  beforeAll(async () => {
    // Fully isolated fixtures under two fresh tenants; other suites' tenants
    // may exist, so assertions are scoped to these ids, never global counts.
    const broken = await makeTenant('sweep-broken');
    const healthy = await makeTenant('sweep-healthy');
    brokenTenantId = broken.id;
    healthyTenantId = healthy.id;

    for (const [tenantId, email] of [
      [brokenTenantId, 'worker@sweep-broken.test'],
      [healthyTenantId, 'worker@sweep-healthy.test'],
    ] as Array<[number, string]>) {
      const employee = await platformPrisma.employee.create({
        data: { tenantId, firstName: 'Sweep', lastName: 'Worker', email },
      });
      const sponsorship = await platformPrisma.sponsorship.create({
        data: {
          tenantId,
          employeeId: employee.id,
          visaType: 'Skilled Worker',
          startDate: d('2026-01-01'),
          active: true,
          cosSalary: 30000,
        },
      });
      if (tenantId === healthyTenantId) healthySponsorshipId = sponsorship.id;

      for (const iso of WEEKDAYS) {
        await platformPrisma.absenceRecord.create({
          data: {
            tenantId,
            employeeId: employee.id,
            date: d(iso),
            status: 'UNAUTHORISED',
            source: 'MANUAL',
          },
        });
      }
      await platformPrisma.payRecord.create({
        data: {
          tenantId,
          employeeId: employee.id,
          periodStart: d('2026-01-01'),
          periodEnd: d('2026-01-31'),
          grossPay: 1500, // below the £30k CoS salary
          source: 'CSV_IMPORT',
        },
      });
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    for (const tenantId of [brokenTenantId, healthyTenantId]) {
      const where = { tenantId };
      await platformPrisma.sponsorshipReportableEvent.deleteMany({ where });
      await platformPrisma.absenceRecord.deleteMany({ where });
      await platformPrisma.payRecord.deleteMany({ where });
      await platformPrisma.sponsorship.deleteMany({ where });
      await platformPrisma.employee.deleteMany({ where });
      await platformPrisma.tenant.delete({ where: { id: tenantId } });
    }
    await platformPrisma.$disconnect();
  });

  const breakTenant = () =>
    jest
      .spyOn(tenantSettings, 'loadWorkingDayConfig')
      .mockImplementation(async (tenantId?: number) => {
        if (tenantId === brokenTenantId) {
          throw new Error('corrupted tenant settings');
        }
        return DEFAULT_WORKING_DAY_CONFIG;
      });

  it('absence sweep: a throwing tenant is reported, the rest still get their events', async () => {
    breakTenant();
    const result = await detectUnauthorisedAbsence(NOW);

    expect(
      result.errors.some((e) => e.includes(`tenant ${brokenTenantId}`)),
    ).toBe(true);

    const healthyEvents =
      await platformPrisma.sponsorshipReportableEvent.findMany({
        where: {
          tenantId: healthyTenantId,
          eventType: 'UNAUTHORISED_ABSENCE_10_DAYS',
        },
      });
    expect(healthyEvents).toHaveLength(1);

    const brokenEvents =
      await platformPrisma.sponsorshipReportableEvent.findMany({
        where: { tenantId: brokenTenantId },
      });
    expect(brokenEvents).toHaveLength(0);
  });

  it('salary sweep: a throwing tenant is reported, the rest still get their events', async () => {
    breakTenant();
    const result = await reconcileSalaries();

    expect(
      result.errors.some((e) => e.includes(`tenant ${brokenTenantId}`)),
    ).toBe(true);

    const healthyEvents =
      await platformPrisma.sponsorshipReportableEvent.findMany({
        where: { tenantId: healthyTenantId, eventType: 'SALARY_BELOW_COS' },
      });
    expect(healthyEvents).toHaveLength(1);
  });

  it('a suspended tenant is skipped entirely, not counted as an error', async () => {
    await platformPrisma.tenant.update({
      where: { id: brokenTenantId },
      data: { status: 'SUSPENDED' },
    });
    try {
      const result = await detectUnauthorisedAbsence(NOW);
      expect(
        result.errors.some((e) => e.includes(`tenant ${brokenTenantId}`)),
      ).toBe(false);
      const brokenEvents =
        await platformPrisma.sponsorshipReportableEvent.findMany({
          where: { tenantId: brokenTenantId },
        });
      expect(brokenEvents).toHaveLength(0);
    } finally {
      await platformPrisma.tenant.update({
        where: { id: brokenTenantId },
        data: { status: 'ACTIVE' },
      });
    }
  });
});
