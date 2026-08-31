import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from '@jest/globals';
import { reconcileSalaries } from '../lib/salarySweep';
import { SALARY_SHORTFALL_EVENT } from '../lib/salaryReconciliation';
import { testPrisma as prisma, testTenantId } from './helpers/tenantTest';

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe('salary reconciliation sweep', () => {
  let employeeId: number;
  let sponsorshipId: number;

  const addPay = (start: string, end: string, grossPay: number) =>
    prisma.payRecord.create({
      data: {
        tenantId: testTenantId(),
        employeeId,
        periodStart: d(start),
        periodEnd: d(end),
        grossPay,
        source: 'CSV_IMPORT',
      },
    });

  const setTerms = (data: Record<string, unknown>) =>
    prisma.sponsorship.updateMany({ where: { id: sponsorshipId }, data });

  const events = () =>
    prisma.sponsorshipReportableEvent.findMany({
      where: { sponsorshipId, eventType: SALARY_SHORTFALL_EVENT },
    });

  beforeAll(async () => {
    await prisma.sponsorshipReportableEvent.deleteMany({});
    await prisma.payRecord.deleteMany({});
    await prisma.sponsorship.deleteMany({});
    await prisma.employee.deleteMany({});

    const employee = await prisma.employee.create({
      data: {
        firstName: 'Under',
        lastName: 'Paid',
        email: 'underpaid@salary.test',
        employeeType: 'EMPLOYEE',
      },
    });
    employeeId = employee.id;

    const sponsorship = await prisma.sponsorship.create({
      data: {
        employeeId,
        visaType: 'Skilled Worker',
        startDate: d('2026-01-01'),
        active: true,
        cosSalary: 30000,
      },
    });
    sponsorshipId = sponsorship.id;
  });

  beforeEach(async () => {
    await prisma.sponsorshipReportableEvent.deleteMany({});
    await prisma.payRecord.deleteMany({});
    await setTerms({ cosSalary: 30000, goingRateSalary: null });
  });

  afterAll(async () => {
    await prisma.sponsorshipReportableEvent.deleteMany({});
    await prisma.payRecord.deleteMany({});
    await prisma.sponsorship.deleteMany({});
    await prisma.employee.deleteMany({});
    await prisma.$disconnect();
  });

  it('raises nothing when every period meets the CoS salary', async () => {
    await addPay('2026-01-01', '2026-01-31', 2600);
    await addPay('2026-02-01', '2026-02-28', 2400);
    const result = await reconcileSalaries();
    expect(result.eventsCreated).toBe(0);
    expect(await events()).toHaveLength(0);
  });

  it('raises one event for a single underpaid period', async () => {
    await addPay('2026-01-01', '2026-01-31', 1500);
    await addPay('2026-02-01', '2026-02-28', 2600);
    const result = await reconcileSalaries();
    expect(result.eventsCreated).toBe(1);

    const raised = await events();
    expect(raised).toHaveLength(1);
    expect(raised[0].notes).toMatch(/shortfall/i);
  });

  it('is idempotent across repeated sweeps', async () => {
    await addPay('2026-01-01', '2026-01-31', 1500);
    await reconcileSalaries();
    const second = await reconcileSalaries();
    expect(second.eventsCreated).toBe(0);
    expect(await events()).toHaveLength(1);
  });

  it('uses the going rate when it exceeds the CoS salary', async () => {
    await setTerms({ cosSalary: 30000, goingRateSalary: 45000 });
    // £2,600/month clears £30k but not £45k.
    await addPay('2026-01-01', '2026-01-31', 2600);
    const result = await reconcileSalaries();
    expect(result.eventsCreated).toBe(1);
  });

  it('counts a sponsorship with no salary recorded as missing, not compliant', async () => {
    await setTerms({ cosSalary: null, goingRateSalary: null });
    await addPay('2026-01-01', '2026-01-31', 1);
    const result = await reconcileSalaries();
    expect(result.eventsCreated).toBe(0);
    expect(result.missingCosTerms).toBeGreaterThanOrEqual(1);
  });
});
