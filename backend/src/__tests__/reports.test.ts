import express from 'express';
import request from './helpers/http';
import * as XLSX from 'xlsx';
import reportsRouter from '../routes/reports';
import {
  testPrisma as prisma,
  signTestToken,
  testTenantId,
} from './helpers/tenantTest';
import { platformPrisma } from '../prismaClient';

const app = express();
app.use(express.json());
app.use('/api/reports', reportsRouter);

const PREFIX = 'reports';
const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

let careId: number;
let adminId: number;
let leaverId: number;
let projectId: number;
let adminToken: string;
let assistantToken: string;
let employeeToken: string;

const daysFromNow = (days: number) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date;
};

async function cleanup() {
  const stale = await prisma.employee.findMany({
    where: { email: { contains: `@${PREFIX}.test` } },
    select: { id: true },
  });
  const ids = stale.map((e: { id: number }) => e.id);
  if (ids.length) {
    await prisma.leaveRequest.deleteMany({ where: { employeeId: { in: ids } } });
    await prisma.timesheet.deleteMany({ where: { employeeId: { in: ids } } });
    await prisma.absenceRecord.deleteMany({ where: { employeeId: { in: ids } } });
    await prisma.employee.updateMany({
      where: { id: { in: ids } },
      data: { managerId: null },
    });
    await prisma.employee.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.project.deleteMany({ where: { name: `${PREFIX} project` } });
}

beforeAll(async () => {
  await cleanup();

  const care = await prisma.employee.create({
    data: {
      firstName: 'Cara',
      lastName: 'Carer',
      email: `care@${PREFIX}.test`,
      department: 'Care',
      employeeType: 'EMPLOYEE',
      startDate: daysFromNow(-10),
      passportExpiryDate: daysFromNow(20),
    },
  });
  careId = care.id;

  const admin = await prisma.employee.create({
    data: {
      firstName: 'Adam',
      lastName: 'Admin',
      email: `admin@${PREFIX}.test`,
      department: 'Admin',
      employeeType: 'EMPLOYEE',
      startDate: new Date('2020-01-01'),
      managerId: careId,
    },
  });
  adminId = admin.id;

  const leaver = await prisma.employee.create({
    data: {
      firstName: 'Lee',
      lastName: 'Leaver',
      email: `leaver@${PREFIX}.test`,
      department: 'Care',
      employeeType: 'EMPLOYEE',
      startDate: new Date('2019-01-01'),
      endDate: daysFromNow(-5),
    },
  });
  leaverId = leaver.id;

  const project = await prisma.project.create({
    data: { name: `${PREFIX} project`, code: 'RPT1' },
  });
  projectId = project.id;

  const thisMonth = new Date();
  thisMonth.setUTCDate(2);
  await prisma.timesheet.create({
    data: { employeeId: careId, projectId, date: thisMonth, hours: 7.5 },
  });
  await prisma.timesheet.create({
    data: { employeeId: adminId, date: thisMonth, hours: 2 },
  });

  const year = new Date().getUTCFullYear();
  await prisma.leaveRequest.create({
    data: {
      employeeId: careId,
      type: 'ANNUAL',
      startDate: new Date(Date.UTC(year, 2, 2)),
      endDate: new Date(Date.UTC(year, 2, 6)),
      days: 5,
      status: 'APPROVED',
    },
  });
  await prisma.leaveRequest.create({
    data: {
      employeeId: adminId,
      type: 'SICK',
      startDate: new Date(Date.UTC(year, 3, 1)),
      endDate: new Date(Date.UTC(year, 3, 2)),
      days: 2,
      status: 'APPROVED',
    },
  });
  await prisma.leaveRequest.create({
    data: {
      employeeId: careId,
      type: 'ANNUAL',
      startDate: new Date(Date.UTC(year, 5, 1)),
      endDate: new Date(Date.UTC(year, 5, 2)),
      days: 2,
      status: 'PENDING',
    },
  });
  await prisma.absenceRecord.create({
    data: {
      employeeId: careId,
      date: new Date(Date.UTC(year, 3, 8)),
      status: 'UNAUTHORISED',
      source: 'MANUAL',
    },
  });

  adminToken = signTestToken({ email: `owner@${PREFIX}.test`, role: 'ADMIN' });
  assistantToken = signTestToken({
    email: `assistant@${PREFIX}.test`,
    role: 'OFFICE_ASSISTANT',
  });
  employeeToken = signTestToken({
    email: `care@${PREFIX}.test`,
    role: 'EMPLOYEE',
    employeeId: careId,
  });
});

afterAll(async () => {
  await cleanup();
  await platformPrisma.tenant.updateMany({
    where: { id: testTenantId() },
    data: { features: {} },
  });
  await prisma.$disconnect();
});

const get = (path: string, token: string) =>
  request(app).get(path).set('Authorization', `Bearer ${token}`);

// Binary responses need collecting by hand; supertest only parses text.
const getFile = (path: string, token: string) =>
  get(path, token)
    .buffer()
    .parse((response, callback) => {
      const chunks: Buffer[] = [];
      response.on('data', (c: Buffer) => chunks.push(c));
      response.on('end', () => callback(null, Buffer.concat(chunks)));
    });

describe('who may read reports', () => {
  it('is owners and directors only', async () => {
    expect((await get('/api/reports/summary', employeeToken)).status).toBe(403);
    expect((await get('/api/reports/summary', assistantToken)).status).toBe(403);
    expect((await get('/api/reports/summary', adminToken)).status).toBe(200);
  });
});

describe('GET /summary', () => {
  it('counts headcount, starters and leavers against the fixtures', async () => {
    const res = await get('/api/reports/summary', adminToken);
    expect(res.status).toBe(200);

    const { headcount } = res.body;
    expect(headcount.active).toBe(2);
    expect(headcount.starters30d).toBeGreaterThanOrEqual(1);
    expect(headcount.leavers30d).toBeGreaterThanOrEqual(1);
    expect(headcount.byDepartment).toEqual(
      expect.arrayContaining([{ name: 'Care', count: 1 }]),
    );
  });

  it('adds up leave for the current leave year, split by type', async () => {
    const { body } = await get('/api/reports/summary', adminToken);
    expect(body.leave.annualUsed).toBe(5);
    expect(body.leave.sickUsed).toBe(2);
    expect(body.leave.pending).toBe(1);
    expect(body.leave.sickByDepartment).toEqual([{ name: 'Admin', days: 2 }]);
  });

  it('buckets expiries and reports hours for the month', async () => {
    const { body } = await get('/api/reports/summary', adminToken);

    expect(body.expiries.buckets).toEqual([30, 60, 90]);
    const passport = body.expiries.byKind.find((k: any) => k.kind === 'PASSPORT');
    expect(passport['30']).toBe(1);

    expect(body.timesheets.hours).toBe(9.5);
    expect(body.timesheets.byProject).toEqual(
      expect.arrayContaining([{ name: `${PREFIX} project`, hours: 7.5 }]),
    );
  });

  it('audits the read', async () => {
    await get('/api/reports/summary', adminToken);
    const audit = await platformPrisma.auditLog.findFirst({
      where: { entity: 'Report', action: 'READ' },
      orderBy: { timestamp: 'desc' },
    });
    expect(JSON.parse(audit!.details!)).toMatchObject({ report: 'summary' });
  });
});

describe('compliance readiness', () => {
  afterEach(async () => {
    await platformPrisma.tenant.updateMany({
      where: { id: testTenantId() },
      data: { features: {} },
    });
  });

  it('is scored when the feature is on and null when it is off', async () => {
    const on = await get('/api/reports/summary', adminToken);
    expect(on.body.readiness).not.toBeNull();
    expect(typeof on.body.readiness.score).toBe('number');

    await platformPrisma.tenant.updateMany({
      where: { id: testTenantId() },
      data: { features: { compliance: false } },
    });

    const off = await get('/api/reports/summary', adminToken);
    expect(off.body.readiness).toBeNull();
    // The rest of the report still works without the compliance module.
    expect(off.body.headcount.active).toBe(2);
  });
});

describe('GET /export/:report', () => {
  it('refuses a report it does not have', async () => {
    const res = await get('/api/reports/export/salaries', adminToken);
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/headcount/);
  });

  it('returns a spreadsheet for every report it does have, and audits it', async () => {
    for (const name of [
      'headcount',
      'leave',
      'absence',
      'expiries',
      'timesheets',
    ]) {
      const res = await getFile(`/api/reports/export/${name}`, adminToken);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe(XLSX_MIME);
      expect(res.headers['content-disposition']).toContain(`${name}-`);

      const workbook = XLSX.read(res.body, { type: 'buffer' });
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        workbook.Sheets[name],
      );
      expect(rows.length).toBeGreaterThan(0);

      const audit = await platformPrisma.auditLog.findFirst({
        where: { entity: 'Report', action: 'EXPORT' },
        orderBy: { timestamp: 'desc' },
      });
      expect(JSON.parse(audit!.details!).report).toBe(name);
    }
  });

  it('writes the reporting line into the headcount sheet', async () => {
    const res = await getFile('/api/reports/export/headcount', adminToken);
    const workbook = XLSX.read(res.body, { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      workbook.Sheets.headcount,
    );
    const adam = rows.find((r) => r['Last name'] === 'Admin');
    expect(adam!['Reports to']).toBe('Cara Carer');
    expect(adam!.Department).toBe('Admin');
  });

  it('is closed to everyone below director', async () => {
    expect(
      (await get('/api/reports/export/headcount', employeeToken)).status,
    ).toBe(403);
  });
});
