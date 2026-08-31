import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import absencesRouter from '../routes/absences';
import payRouter from '../routes/pay';
import {
  testPrisma as prisma,
  signTestToken,
  testTenantId,
} from './helpers/tenantTest';

const app = express();
app.use(express.json());
app.use('/api/absences', absencesRouter);
app.use('/api/pay', payRouter);

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

// Absence carries sick-leave history and pay carries salary — both are private
// to the worker and to HR. A colleague on the same tenant must not read either.
describe('compliance data access control', () => {
  let subjectId: number;
  let snooperId: number;
  let adminToken: string;
  let snooperToken: string;
  let subjectToken: string;

  beforeAll(async () => {
    await prisma.absenceRecord.deleteMany({});
    await prisma.payRecord.deleteMany({});
    await prisma.sponsorship.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.employee.deleteMany({});

    const subject = await prisma.employee.create({
      data: {
        firstName: 'Subject',
        lastName: 'Worker',
        email: 'subject@access.test',
        employeeType: 'EMPLOYEE',
      },
    });
    subjectId = subject.id;

    const snooper = await prisma.employee.create({
      data: {
        firstName: 'Nosy',
        lastName: 'Colleague',
        email: 'snooper@access.test',
        employeeType: 'EMPLOYEE',
      },
    });
    snooperId = snooper.id;

    await prisma.absenceRecord.create({
      data: {
        tenantId: testTenantId(),
        employeeId: subjectId,
        date: d('2026-09-07'),
        status: 'SICK',
        source: 'MANUAL',
      },
    });
    await prisma.payRecord.create({
      data: {
        tenantId: testTenantId(),
        employeeId: subjectId,
        periodStart: d('2026-01-01'),
        periodEnd: d('2026-01-31'),
        grossPay: 2500,
        source: 'CSV_IMPORT',
      },
    });

    adminToken = `Bearer ${signTestToken({ email: 'admin@access.test', role: 'ADMIN' })}`;
    snooperToken = `Bearer ${signTestToken({
      email: 'snooper@access.test',
      role: 'EMPLOYEE',
      employeeId: snooperId,
    })}`;
    subjectToken = `Bearer ${signTestToken({
      email: 'subject@access.test',
      role: 'EMPLOYEE',
      employeeId: subjectId,
    })}`;
  });

  afterAll(async () => {
    await prisma.absenceRecord.deleteMany({});
    await prisma.payRecord.deleteMany({});
    await prisma.employee.deleteMany({});
    await prisma.$disconnect();
  });

  it('lets HR read a worker absence ledger', async () => {
    const res = await request(app)
      .get(`/api/absences/employee/${subjectId}?from=2026-09-01&to=2026-09-30`)
      .set('Authorization', adminToken);
    expect(res.status).toBe(200);
    expect(res.body.days.length).toBeGreaterThan(0);
  });

  it('lets a worker read their own absence ledger', async () => {
    const res = await request(app)
      .get(`/api/absences/employee/${subjectId}`)
      .set('Authorization', subjectToken);
    expect(res.status).toBe(200);
  });

  it('stops a colleague reading someone else absence and sick leave', async () => {
    const res = await request(app)
      .get(`/api/absences/employee/${subjectId}`)
      .set('Authorization', snooperToken);
    expect(res.status).toBe(404);
  });

  it('lets HR read a worker pay history', async () => {
    const res = await request(app)
      .get(`/api/pay/employee/${subjectId}`)
      .set('Authorization', adminToken);
    expect(res.status).toBe(200);
    expect(res.body.periods.length).toBeGreaterThan(0);
  });

  it('lets a worker read their own pay history', async () => {
    const res = await request(app)
      .get(`/api/pay/employee/${subjectId}`)
      .set('Authorization', subjectToken);
    expect(res.status).toBe(200);
  });

  it('stops a colleague reading someone else salary', async () => {
    const res = await request(app)
      .get(`/api/pay/employee/${subjectId}`)
      .set('Authorization', snooperToken);
    expect(res.status).toBe(404);
  });

  it('stops a colleague recording absence against someone else', async () => {
    const res = await request(app)
      .post('/api/absences')
      .set('Authorization', snooperToken)
      .send({
        employeeId: subjectId,
        date: '2026-09-08',
        status: 'UNAUTHORISED',
      });
    expect(res.status).toBe(403);
  });
});
