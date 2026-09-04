import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import express from 'express';
import request from './helpers/http';
import employeesRouter from '../routes/employees';
import sponsorshipsRouter from '../routes/sponsorships';
import { platformPrisma } from '../prismaClient';
import { testPrisma as prisma, signTestToken } from './helpers/tenantTest';

// Right-to-work checks: a history table whose newest passed check doubles as
// Appendix D 2(a) evidence on every active sponsorship, with the share code
// encrypted at rest and visible to the worker only for their own record.

const app = express();
app.use(express.json());
app.use('/api/employees', employeesRouter);
app.use('/api/sponsorships', sponsorshipsRouter);

const PREFIX = 'rtw';

describe('Right-to-work checks', () => {
  let admin: string;
  let assistant: string;
  let director: string;
  let workerToken: string;
  let colleagueToken: string;
  let workerId: number;
  let colleagueId: number;
  let sponsorshipId: number;
  let documentId: number;

  async function cleanup() {
    const stale = await prisma.employee.findMany({
      where: { email: { contains: `@${PREFIX}.test` } },
      select: { id: true },
    });
    const ids = stale.map((e: { id: number }) => e.id);
    if (ids.length === 0) return;
    await prisma.sponsorship.deleteMany({ where: { employeeId: { in: ids } } });
    await prisma.document.deleteMany({ where: { employeeId: { in: ids } } });
    await prisma.employee.deleteMany({ where: { id: { in: ids } } });
  }

  beforeAll(async () => {
    await cleanup();

    const worker = await prisma.employee.create({
      data: {
        firstName: 'Right',
        lastName: 'ToWork',
        email: `worker@${PREFIX}.test`,
        visaExpiryDate: new Date('2027-06-30'),
      },
    });
    workerId = worker.id;
    const colleague = await prisma.employee.create({
      data: {
        firstName: 'Nosy',
        lastName: 'Colleague',
        email: `colleague@${PREFIX}.test`,
      },
    });
    colleagueId = colleague.id;
    const sponsorship = await prisma.sponsorship.create({
      data: {
        employeeId: workerId,
        visaType: 'Skilled Worker',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2027-06-30'),
        active: true,
      },
    });
    sponsorshipId = sponsorship.id;
    const document = await prisma.document.create({
      data: {
        employeeId: workerId,
        name: 'share-code.pdf',
        path: 'x/share-code.pdf',
        type: 'RTW',
      },
    });
    documentId = document.id;

    admin = signTestToken({ email: `admin@${PREFIX}.test`, role: 'ADMIN' });
    assistant = signTestToken({
      email: `assistant@${PREFIX}.test`,
      role: 'OFFICE_ASSISTANT',
    });
    director = signTestToken({ email: `director@${PREFIX}.test`, role: 'DIRECTOR' });
    workerToken = signTestToken({
      email: `worker@${PREFIX}.test`,
      role: 'EMPLOYEE',
      employeeId: workerId,
    });
    colleagueToken = signTestToken({
      email: `colleague@${PREFIX}.test`,
      role: 'EMPLOYEE',
      employeeId: colleagueId,
    });
  });

  afterAll(cleanup);

  it('refuses an online check without the share code that evidences it', async () => {
    const res = await request(app)
      .post(`/api/employees/${workerId}/rtw`)
      .set('Authorization', `Bearer ${assistant}`)
      .send({ method: 'HOME_OFFICE_ONLINE', checkDate: '2026-01-05' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/shareCode/);
  });

  it('rejects unknown methods and future dates', async () => {
    const bad = await request(app)
      .post(`/api/employees/${workerId}/rtw`)
      .set('Authorization', `Bearer ${assistant}`)
      .send({ method: 'GUESSWORK' });
    expect(bad.status).toBe(400);
    const future = await request(app)
      .post(`/api/employees/${workerId}/rtw`)
      .set('Authorization', `Bearer ${assistant}`)
      .send({ method: 'MANUAL', checkDate: '2099-01-01' });
    expect(future.status).toBe(400);
  });

  it('records an online check, encrypts the share code and files the evidence', async () => {
    const res = await request(app)
      .post(`/api/employees/${workerId}/rtw`)
      .set('Authorization', `Bearer ${assistant}`)
      .send({
        method: 'HOME_OFFICE_ONLINE',
        checkDate: '2026-01-05',
        shareCode: 'W1234567X',
        timeLimited: true,
        documentId,
        notes: 'Checked against the online service',
      });
    expect(res.status).toBe(201);
    expect(res.body.shareCode).toBe('W1234567X');
    // No recheckDue given → defaults to the visa expiry on record.
    expect(res.body.recheckDue.slice(0, 10)).toBe('2027-06-30');

    const raw = await platformPrisma.$queryRawUnsafe<{ shareCode: string }[]>(
      'SELECT shareCode FROM RightToWorkCheck WHERE id = ?',
      res.body.id,
    );
    expect(raw[0].shareCode.startsWith('enc:v1:')).toBe(true);

    const evidence = await prisma.sponsorshipComplianceEvidence.findMany({
      where: { sponsorshipId, evidenceType: 'RIGHT_TO_WORK_CHECK' },
    });
    expect(evidence).toHaveLength(1);
    expect(evidence[0].verifiedAt?.toISOString().slice(0, 10)).toBe('2026-01-05');
    expect(evidence[0].documentId).toBe(documentId);

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'CREATE', entity: 'RightToWorkCheck', entityId: res.body.id },
    });
    expect(audit).not.toBeNull();
    expect(JSON.parse(audit!.details).evidenceCreated).toBe(1);
  });

  it('shows the check as complete on the compliance pack with date and method', async () => {
    const res = await request(app)
      .get(`/api/sponsorships/${sponsorshipId}/compliance`)
      .set('Authorization', `Bearer ${director}`);
    expect(res.status).toBe(200);
    const rtw = res.body.requiredEvidence.find(
      (i: any) => i.key === 'RIGHT_TO_WORK_CHECK',
    );
    expect(rtw.status).toBe('COMPLETE');
    expect(rtw.verified).toBe(true);
    expect(res.body.sponsorship.sponsoredRoute).toBe(true);
  });

  it('a time-limited check needs a recheck date when there is no visa expiry to fall back on', async () => {
    const res = await request(app)
      .post(`/api/employees/${colleagueId}/rtw`)
      .set('Authorization', `Bearer ${assistant}`)
      .send({ method: 'MANUAL', timeLimited: true });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/recheckDue/);
  });

  it('a worker reads their own history but nobody else’s', async () => {
    const own = await request(app)
      .get(`/api/employees/${workerId}/rtw`)
      .set('Authorization', `Bearer ${workerToken}`);
    expect(own.status).toBe(200);
    expect(own.body).toHaveLength(1);
    expect(own.body[0].method).toBe('HOME_OFFICE_ONLINE');

    const other = await request(app)
      .get(`/api/employees/${workerId}/rtw`)
      .set('Authorization', `Bearer ${colleagueToken}`);
    expect(other.status).toBe(404);

    const write = await request(app)
      .post(`/api/employees/${workerId}/rtw`)
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ method: 'MANUAL' });
    expect(write.status).toBe(403);
  });

  it('a failed check is kept in history but does not become evidence', async () => {
    const res = await request(app)
      .post(`/api/employees/${colleagueId}/rtw`)
      .set('Authorization', `Bearer ${director}`)
      .send({ method: 'MANUAL', outcome: 'FAIL', checkDate: '2026-02-01' });
    expect(res.status).toBe(201);
    const list = await request(app)
      .get(`/api/employees/${colleagueId}/rtw`)
      .set('Authorization', `Bearer ${admin}`);
    expect(list.body[0].outcome).toBe('FAIL');
  });

  it('only the owner can delete a check, and it is audited', async () => {
    const list = await request(app)
      .get(`/api/employees/${colleagueId}/rtw`)
      .set('Authorization', `Bearer ${admin}`);
    const checkId = list.body[0].id;

    const denied = await request(app)
      .delete(`/api/employees/${colleagueId}/rtw/${checkId}`)
      .set('Authorization', `Bearer ${assistant}`);
    expect(denied.status).toBe(403);

    const wrongEmployee = await request(app)
      .delete(`/api/employees/${workerId}/rtw/${checkId}`)
      .set('Authorization', `Bearer ${admin}`);
    expect(wrongEmployee.status).toBe(404);

    const ok = await request(app)
      .delete(`/api/employees/${colleagueId}/rtw/${checkId}`)
      .set('Authorization', `Bearer ${admin}`);
    expect(ok.status).toBe(200);
    const audit = await prisma.auditLog.findFirst({
      where: { action: 'DELETE', entity: 'RightToWorkCheck', entityId: checkId },
    });
    expect(audit).not.toBeNull();
  });
});
