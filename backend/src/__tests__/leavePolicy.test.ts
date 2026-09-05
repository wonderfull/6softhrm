import express from 'express';
import request from './helpers/http';
import leaveRouter from '../routes/leave';
import tenantRouter from '../routes/tenant';
import employeesRouter from '../routes/employees';
import {
  testPrisma as prisma,
  signTestToken,
  testTenantId,
} from './helpers/tenantTest';
import { platformPrisma } from '../prismaClient';

const app = express();
app.use(express.json());
app.use('/api/leave', leaveRouter);
app.use('/api/tenant', tenantRouter);
app.use('/api/employees', employeesRouter);

const PREFIX = 'leave-policy';

let managerId: number;
let reportId: number;
let strangerId: number;
let adminToken: string;
let managerToken: string;
let reportToken: string;
let strangerToken: string;

async function cleanup() {
  const stale = await prisma.employee.findMany({
    where: { email: { contains: `@${PREFIX}.test` } },
    select: { id: true },
  });
  const ids = stale.map((e: { id: number }) => e.id);
  if (ids.length === 0) return;
  await prisma.leaveRequest.deleteMany({ where: { employeeId: { in: ids } } });
  await prisma.employee.updateMany({
    where: { id: { in: ids } },
    data: { managerId: null },
  });
  await prisma.employee.deleteMany({ where: { id: { in: ids } } });
}

const makeEmployee = (first: string, local: string, extra: any = {}) =>
  prisma.employee.create({
    data: {
      firstName: first,
      lastName: 'Tester',
      email: `${local}@${PREFIX}.test`,
      jobTitle: 'Tester',
      employeeType: 'EMPLOYEE',
      department: 'Care',
      startDate: new Date('2020-01-01'),
      ...extra,
    },
  });

beforeAll(async () => {
  await cleanup();

  const manager = await makeEmployee('Mo', 'manager');
  managerId = manager.id;
  const report = await makeEmployee('Rae', 'report', { managerId });
  reportId = report.id;
  const stranger = await makeEmployee('Sam', 'stranger', {
    department: 'Admin',
  });
  strangerId = stranger.id;

  adminToken = signTestToken({
    email: `admin@${PREFIX}.test`,
    role: 'ADMIN',
  });
  managerToken = signTestToken({
    email: `manager@${PREFIX}.test`,
    role: 'EMPLOYEE',
    employeeId: managerId,
  });
  reportToken = signTestToken({
    email: `report@${PREFIX}.test`,
    role: 'EMPLOYEE',
    employeeId: reportId,
  });
  strangerToken = signTestToken({
    email: `stranger@${PREFIX}.test`,
    role: 'EMPLOYEE',
    employeeId: strangerId,
  });
});

afterAll(async () => {
  await cleanup();
  await platformPrisma.tenantSettings.deleteMany({
    where: { tenantId: testTenantId() },
  });
  await prisma.$disconnect();
});

afterEach(async () => {
  await prisma.leaveRequest.deleteMany({
    where: { employeeId: { in: [managerId, reportId, strangerId] } },
  });
  await prisma.employee.updateMany({
    where: { id: reportId },
    data: { leaveAllowanceDays: null, leaveCarriedOverDays: null },
  });
});

const post = (token: string, body: any) =>
  request(app).post('/api/leave').set('Authorization', `Bearer ${token}`).send(body);

describe('booking leave', () => {
  it('refuses a type outside the seven the policy knows', async () => {
    const res = await post(reportToken, {
      type: 'PERSONAL',
      startDate: '2026-03-02',
      endDate: '2026-03-03',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/type must be one of/);
  });

  it('refuses a range with no working day in it', async () => {
    const res = await post(reportToken, {
      type: 'ANNUAL',
      startDate: '2026-08-01',
      endDate: '2026-08-02',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/at least one working day/);
  });

  it('stores the working days the range actually costs', async () => {
    // 24-29 Dec 2026: Christmas Day, the Boxing Day substitute and a weekend
    // sit inside it, so the request is two days of leave, not six.
    const res = await post(reportToken, {
      type: 'ANNUAL',
      startDate: '2026-12-24',
      endDate: '2026-12-29',
      reason: 'Christmas',
    });
    expect(res.status).toBe(200);
    expect(res.body.days).toBe(2);

    const stored = await prisma.leaveRequest.findFirst({
      where: { id: res.body.id },
    });
    expect(stored.days).toBe(2);
    expect(stored.status).toBe('PENDING');
  });

  it('refuses a second request over the same days', async () => {
    const first = await post(reportToken, {
      type: 'ANNUAL',
      startDate: '2026-03-02',
      endDate: '2026-03-06',
    });
    expect(first.status).toBe(200);

    const clash = await post(reportToken, {
      type: 'SICK',
      startDate: '2026-03-06',
      endDate: '2026-03-10',
    });
    expect(clash.status).toBe(409);
    expect(clash.body.error).toMatch(/overlaps/);
  });

  it('refuses annual leave beyond the remaining allowance', async () => {
    await prisma.employee.updateMany({
      where: { id: reportId },
      data: { leaveAllowanceDays: 3 },
    });

    const res = await post(reportToken, {
      type: 'ANNUAL',
      startDate: '2026-03-02',
      endDate: '2026-03-06',
    });
    expect(res.status).toBe(409);
    expect(res.body.remaining).toBe(3);
    expect(res.body.requested).toBe(5);

    // Unpaid leave is not drawn from the allowance, so it still goes through.
    const unpaid = await post(reportToken, {
      type: 'UNPAID',
      startDate: '2026-03-02',
      endDate: '2026-03-06',
    });
    expect(unpaid.status).toBe(200);
  });
});

describe('GET /days and /balance', () => {
  it('counts working days on the tenant calendar', async () => {
    const res = await request(app)
      .get('/api/leave/days?start=2026-12-24&end=2026-12-29')
      .set('Authorization', `Bearer ${reportToken}`);
    expect(res.status).toBe(200);
    expect(res.body.days).toBe(2);
  });

  it('returns a balance that moves as leave is booked', async () => {
    const before = await request(app)
      .get('/api/leave/balance')
      .set('Authorization', `Bearer ${reportToken}`);
    expect(before.status).toBe(200);
    expect(before.body.allowance).toBe(28);
    expect(before.body.remaining).toBe(28);
    expect(before.body.leaveYear.label).toBe('2026');

    await post(reportToken, {
      type: 'ANNUAL',
      startDate: '2026-03-02',
      endDate: '2026-03-06',
    });

    const after = await request(app)
      .get('/api/leave/balance')
      .set('Authorization', `Bearer ${reportToken}`);
    expect(after.body.pending).toBe(5);
    expect(after.body.remaining).toBe(23);
  });

  it('keeps a balance private from an unrelated colleague but not from the line manager', async () => {
    const stranger = await request(app)
      .get(`/api/leave/balance?employeeId=${reportId}`)
      .set('Authorization', `Bearer ${strangerToken}`);
    expect(stranger.status).toBe(403);

    const manager = await request(app)
      .get(`/api/leave/balance?employeeId=${reportId}`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(manager.status).toBe(200);
    expect(manager.body.remaining).toBe(28);
  });
});

describe('the reporting line', () => {
  it('shows a manager their own and their reports\' requests, and nobody else\'s', async () => {
    await post(reportToken, {
      type: 'ANNUAL',
      startDate: '2026-03-02',
      endDate: '2026-03-06',
    });
    await post(strangerToken, {
      type: 'ANNUAL',
      startDate: '2026-03-02',
      endDate: '2026-03-06',
    });

    const res = await request(app)
      .get('/api/leave')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    const ids = res.body.map((r: any) => r.employeeId);
    expect(ids).toContain(reportId);
    expect(ids).not.toContain(strangerId);
  });

  it('lets a manager decide their report\'s request while a bystander cannot', async () => {
    const created = await post(reportToken, {
      type: 'ANNUAL',
      startDate: '2026-03-02',
      endDate: '2026-03-06',
    });
    const id = created.body.id;

    const bystander = await request(app)
      .put(`/api/leave/${id}/approve`)
      .set('Authorization', `Bearer ${strangerToken}`)
      .send({});
    expect(bystander.status).toBe(403);

    const decided = await request(app)
      .put(`/api/leave/${id}/approve`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ note: 'Enjoy' });
    expect(decided.status).toBe(200);
    expect(decided.body.status).toBe('APPROVED');
    expect(decided.body.decisionNote).toBe('Enjoy');
    expect(decided.body.decidedBy).toBe(`manager@${PREFIX}.test`);
    expect(decided.body.decidedAt).toBeTruthy();
  });

  it('refuses a reporting line that loops back on itself', async () => {
    const res = await request(app)
      .put(`/api/employees/${managerId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ managerId: reportId });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/loops back/);

    const self = await request(app)
      .put(`/api/employees/${reportId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ managerId: reportId });
    expect(self.status).toBe(400);
    expect(self.body.error).toMatch(/report to themselves/);
  });
});

describe('the company calendar', () => {
  beforeEach(async () => {
    const booked = await post(reportToken, {
      type: 'SICK',
      startDate: '2026-12-24',
      endDate: '2026-12-29',
    });
    await prisma.leaveRequest.updateMany({
      where: { id: booked.body.id },
      data: { status: 'APPROVED' },
    });
  });

  it('tells a bystander that someone is away without saying why', async () => {
    const res = await request(app)
      .get('/api/leave/calendar?from=2026-12-01&to=2026-12-31')
      .set('Authorization', `Bearer ${strangerToken}`);
    expect(res.status).toBe(200);
    const entry = res.body.entries.find((e: any) => e.employeeId === reportId);
    expect(entry.type).toBe('LEAVE');
    expect(entry.employeeName).toBe('Rae Tester');
    expect(res.body.bankHolidays).toEqual(
      expect.arrayContaining(['2026-12-25', '2026-12-28']),
    );
  });

  it('shows the real reason to the line manager and to the person themselves', async () => {
    const manager = await request(app)
      .get('/api/leave/calendar?from=2026-12-01&to=2026-12-31')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(
      manager.body.entries.find((e: any) => e.employeeId === reportId).type,
    ).toBe('SICK');

    const own = await request(app)
      .get('/api/leave/calendar?from=2026-12-01&to=2026-12-31')
      .set('Authorization', `Bearer ${reportToken}`);
    expect(own.body.entries.find((e: any) => e.employeeId === reportId).type).toBe(
      'SICK',
    );
  });

  it('filters by department', async () => {
    const res = await request(app)
      .get('/api/leave/calendar?from=2026-12-01&to=2026-12-31&department=Admin')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.entries.every((e: any) => e.department === 'Admin')).toBe(
      true,
    );
  });
});

describe('withdrawing a request', () => {
  it('lets the owner withdraw while pending and refuses once decided', async () => {
    const created = await post(reportToken, {
      type: 'ANNUAL',
      startDate: '2026-03-02',
      endDate: '2026-03-06',
    });
    const id = created.body.id;

    const stranger = await request(app)
      .delete(`/api/leave/${id}`)
      .set('Authorization', `Bearer ${strangerToken}`);
    expect(stranger.status).toBe(403);

    const own = await request(app)
      .delete(`/api/leave/${id}`)
      .set('Authorization', `Bearer ${reportToken}`);
    expect(own.status).toBe(200);

    const second = await post(reportToken, {
      type: 'ANNUAL',
      startDate: '2026-04-06',
      endDate: '2026-04-07',
    });
    await prisma.leaveRequest.updateMany({
      where: { id: second.body.id },
      data: { status: 'APPROVED' },
    });
    const decided = await request(app)
      .delete(`/api/leave/${second.body.id}`)
      .set('Authorization', `Bearer ${reportToken}`);
    expect(decided.status).toBe(409);

    const byAdmin = await request(app)
      .delete(`/api/leave/${second.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(byAdmin.status).toBe(200);
  });
});

describe('tenant leave settings', () => {
  it('lets any signed-in user read the policy but only the owner change it', async () => {
    const read = await request(app)
      .get('/api/tenant/settings')
      .set('Authorization', `Bearer ${reportToken}`);
    expect(read.status).toBe(200);
    expect(read.body.defaultLeaveDays).toBe(28);

    const refused = await request(app)
      .put('/api/tenant/settings')
      .set('Authorization', `Bearer ${reportToken}`)
      .send({ defaultLeaveDays: 30 });
    expect(refused.status).toBe(403);
  });

  it('validates the policy it is given', async () => {
    const cases = [
      { leaveYearStart: '2026-04-06' },
      { defaultLeaveDays: -1 },
      { bankHolidayRegion: 'wales' },
      { workingDays: '1,2,9' },
      {},
    ];
    for (const body of cases) {
      const res = await request(app)
        .put('/api/tenant/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(body);
      expect(res.status).toBe(400);
    }
  });

  it('saves the policy and the leave year it implies takes effect', async () => {
    const saved = await request(app)
      .put('/api/tenant/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        leaveYearStart: '04-06',
        defaultLeaveDays: 25,
        carryoverCapDays: 5,
        bankHolidayRegion: 'scotland',
        workingDays: '1,2,3,4',
      });
    expect(saved.status).toBe(200);
    expect(saved.body.leaveYearStart).toBe('04-06');
    expect(saved.body.workingDays).toBe('1,2,3,4');

    const balance = await request(app)
      .get('/api/leave/balance')
      .set('Authorization', `Bearer ${reportToken}`);
    expect(balance.body.allowance).toBe(25);
    expect(balance.body.leaveYear.label).toBe('2026/27');

    // Friday is no longer a working day, so a Tuesday-to-Friday week off is
    // three days of leave rather than four.
    const days = await request(app)
      .get('/api/leave/days?start=2026-12-01&end=2026-12-04')
      .set('Authorization', `Bearer ${reportToken}`);
    expect(days.body.days).toBe(3);

    // Scotland keeps 4 January as a holiday when England is back at work.
    const newYear = await request(app)
      .get('/api/leave/days?start=2027-01-04&end=2027-01-04')
      .set('Authorization', `Bearer ${reportToken}`);
    expect(newYear.body.days).toBe(0);

    const audit = await platformPrisma.auditLog.findFirst({
      where: { entity: 'TenantSettings', action: 'UPDATE' },
      orderBy: { timestamp: 'desc' },
    });
    expect(audit).toBeTruthy();
  });
});
