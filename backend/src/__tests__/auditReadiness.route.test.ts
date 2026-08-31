import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import sponsorshipsRouter from '../routes/sponsorships';
import {
  testPrisma as prisma,
  signTestToken,
  testTenantId,
} from './helpers/tenantTest';

const app = express();
app.use(express.json());
app.use('/api/sponsorships', sponsorshipsRouter);

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

// Pay is fetched for every sponsored worker in one query and grouped in memory,
// so the interesting case is several workers with different pay histories: the
// grouping must not attribute one worker's shortfall to another.
describe('GET /sponsorships/audit-readiness', () => {
  let token: string;
  const workers: Record<string, number> = {};

  const addWorker = async (
    key: string,
    email: string,
    cosSalary: number | null,
    pay: Array<[string, string, number]>,
  ) => {
    const employee = await prisma.employee.create({
      data: {
        firstName: key,
        lastName: 'Worker',
        email,
        employeeType: 'EMPLOYEE',
      },
    });
    workers[key] = employee.id;
    await prisma.sponsorship.create({
      data: {
        tenantId: testTenantId(),
        employeeId: employee.id,
        visaType: 'Skilled Worker',
        startDate: d('2026-01-01'),
        active: true,
        cosSalary,
      },
    });
    for (const [start, end, grossPay] of pay) {
      await prisma.payRecord.create({
        data: {
          tenantId: testTenantId(),
          employeeId: employee.id,
          periodStart: d(start),
          periodEnd: d(end),
          grossPay,
          source: 'CSV_IMPORT',
        },
      });
    }
  };

  beforeAll(async () => {
    await prisma.sponsorshipReportableEvent.deleteMany({});
    await prisma.sponsorshipComplianceEvidence.deleteMany({});
    await prisma.payRecord.deleteMany({});
    await prisma.absenceRecord.deleteMany({});
    await prisma.sponsorship.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.employee.deleteMany({});

    // paid correctly
    await addWorker('Compliant', 'compliant@readiness.test', 30000, [
      ['2026-01-01', '2026-01-31', 2600],
      ['2026-02-01', '2026-02-28', 2500],
    ]);
    // two short periods
    await addWorker('Underpaid', 'underpaid@readiness.test', 30000, [
      ['2026-01-01', '2026-01-31', 1500],
      ['2026-02-01', '2026-02-28', 1400],
    ]);
    // no CoS terms, so cannot be assessed at all
    await addWorker('Unknown', 'unknown@readiness.test', null, [
      ['2026-01-01', '2026-01-31', 1],
    ]);

    token = `Bearer ${signTestToken({ email: 'admin@readiness.test', role: 'ADMIN' })}`;
  });

  afterAll(async () => {
    await prisma.payRecord.deleteMany({});
    await prisma.sponsorship.deleteMany({});
    await prisma.employee.deleteMany({});
    await prisma.$disconnect();
  });

  const get = () =>
    request(app)
      .get('/api/sponsorships/audit-readiness')
      .set('Authorization', token);

  it('attributes each shortfall to the right worker', async () => {
    const res = await get();
    expect(res.status).toBe(200);
    const salary = res.body.components.find(
      (c: any) => c.key === 'salaryFailures',
    );
    // Only the underpaid worker's two periods count; the compliant worker's
    // pay must not be scored against anyone else's threshold.
    expect(salary.count).toBe(2);
  });

  it('counts a sponsorship with no CoS terms as missing, not as a pass', async () => {
    const res = await get();
    const missing = res.body.components.find(
      (c: any) => c.key === 'missingCosTerms',
    );
    expect(missing.count).toBe(1);
  });

  it('reports the active sponsorship count and a bounded score', async () => {
    const res = await get();
    expect(res.body.activeSponsorships).toBe(3);
    expect(res.body.score).toBeGreaterThanOrEqual(0);
    expect(res.body.score).toBeLessThanOrEqual(100);
    expect(['READY', 'AT_RISK', 'NOT_READY']).toContain(res.body.band);
  });

  it('surfaces the guidance versions', async () => {
    const res = await get();
    expect(res.body.guidance.appendixD).toBeTruthy();
  });

  it('refuses a plain employee', async () => {
    const res = await request(app)
      .get('/api/sponsorships/audit-readiness')
      .set(
        'Authorization',
        `Bearer ${signTestToken({ email: 'emp@readiness.test', role: 'EMPLOYEE' })}`,
      );
    expect(res.status).toBe(403);
  });
});
