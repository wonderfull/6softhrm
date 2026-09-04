import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import employeesRouter from '../routes/employees';
import gdprRouter from '../routes/gdpr';
import { platformPrisma } from '../prismaClient';
import { computeRetainUntil, runRetentionSweep } from '../lib/retention';
import {
  testPrisma as prisma,
  signTestToken,
  testTenantId,
} from './helpers/tenantTest';

// Retention: a leaver's record carries a retainUntil date derived from the
// longest rule that applies; erasure strips the person but keeps the row so
// leave and timesheet history still adds up; the nightly sweep enforces both
// the employee date and the tenant grace period.

const app = express();
app.use(express.json());
app.use('/api/employees', employeesRouter);
app.use('/api/gdpr', gdprRouter);

const PREFIX = 'ret';
const DAY = 24 * 60 * 60 * 1000;

describe('computeRetainUntil', () => {
  it('keeps the record six years after leaving by default', () => {
    const until = computeRetainUntil(new Date('2026-03-31'));
    expect(until.toISOString().slice(0, 10)).toBe('2032-03-31');
  });

  it('is extended when a sponsorship outlasts the six-year rule', () => {
    const until = computeRetainUntil(new Date('2026-03-31'), [
      { endDate: new Date('2033-01-01') },
      { endDate: null },
    ]);
    expect(until.toISOString().slice(0, 10)).toBe('2034-01-01');
  });
});

describe('Erasure and the retention sweep', () => {
  let admin: string;
  let director: string;
  let sponsoredId: number;
  let leaverId: number;
  let leaverUserId: number;

  async function cleanup() {
    const stale = await prisma.employee.findMany({
      where: {
        OR: [
          { email: { contains: `@${PREFIX}.test` } },
          { email: { startsWith: 'erased-' } },
        ],
      },
      select: { id: true },
    });
    const ids = stale.map((e: { id: number }) => e.id);
    if (ids.length) {
      await prisma.sponsorship.deleteMany({ where: { employeeId: { in: ids } } });
      await prisma.leaveRequest.deleteMany({ where: { employeeId: { in: ids } } });
      await prisma.user.deleteMany({ where: { employeeId: { in: ids } } });
      await prisma.employee.deleteMany({ where: { id: { in: ids } } });
    }
    await platformPrisma.tenant.deleteMany({
      where: { slug: { startsWith: `${PREFIX}-purge-` } },
    });
  }

  beforeAll(async () => {
    await cleanup();
    const sponsored = await prisma.employee.create({
      data: {
        firstName: 'Still',
        lastName: 'Sponsored',
        email: `sponsored@${PREFIX}.test`,
        endDate: new Date('2026-01-31'),
      },
    });
    sponsoredId = sponsored.id;
    await prisma.sponsorship.create({
      data: {
        employeeId: sponsoredId,
        visaType: 'Skilled Worker',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2027-01-01'),
        active: true,
      },
    });

    const leaver = await prisma.employee.create({
      data: {
        firstName: 'Gone',
        lastName: 'Leaver',
        email: `leaver@${PREFIX}.test`,
        niNumber: 'QQ123456C',
        phoneNumber: '07000000000',
        endDate: new Date('2019-01-31'),
        retainUntil: new Date('2025-01-31'),
      },
    });
    leaverId = leaver.id;
    const user = await prisma.user.create({
      data: {
        email: `leaver@${PREFIX}.test`,
        password: 'x',
        role: 'EMPLOYEE',
        employeeId: leaverId,
      },
    });
    leaverUserId = user.id;
    await prisma.leaveRequest.create({
      data: {
        employeeId: leaverId,
        type: 'ANNUAL',
        startDate: new Date('2018-08-01'),
        endDate: new Date('2018-08-03'),
        status: 'APPROVED',
      },
    });

    admin = signTestToken({ email: `admin@${PREFIX}.test`, role: 'ADMIN' });
    director = signTestToken({ email: `director@${PREFIX}.test`, role: 'DIRECTOR' });
  });

  afterAll(cleanup);

  it('setting an end date fills in retainUntil from the longest applicable rule', async () => {
    const created = await prisma.employee.create({
      data: { firstName: 'New', lastName: 'Leaver', email: `newleaver@${PREFIX}.test` },
    });
    const res = await request(app)
      .put(`/api/employees/${created.id}`)
      .set('Authorization', `Bearer ${director}`)
      .send({ endDate: '2026-06-30', retainUntil: '2020-01-01' });
    expect(res.status).toBe(200);
    // A director cannot shorten retention; the rule wins.
    expect(res.body.retainUntil.slice(0, 10)).toBe('2032-06-30');

    // The owner can set a legal hold, and it survives an unrelated edit.
    const held = await request(app)
      .put(`/api/employees/${created.id}`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ retainUntil: '2040-01-01' });
    expect(held.body.retainUntil.slice(0, 10)).toBe('2040-01-01');
    const edited = await request(app)
      .put(`/api/employees/${created.id}`)
      .set('Authorization', `Bearer ${director}`)
      .send({ endDate: '2026-06-30', jobTitle: 'Former analyst' });
    expect(edited.body.retainUntil.slice(0, 10)).toBe('2040-01-01');
    // Moving the leaving date recomputes it.
    const moved = await request(app)
      .put(`/api/employees/${created.id}`)
      .set('Authorization', `Bearer ${director}`)
      .send({ endDate: '2026-07-31' });
    expect(moved.body.retainUntil.slice(0, 10)).toBe('2032-07-31');
  });

  it('refuses to erase while a sponsorship is active, unless forced', async () => {
    const noReason = await request(app)
      .post(`/api/gdpr/erase/${sponsoredId}`)
      .set('Authorization', `Bearer ${admin}`)
      .send({});
    expect(noReason.status).toBe(400);

    const blocked = await request(app)
      .post(`/api/gdpr/erase/${sponsoredId}`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ reason: 'Subject access request' });
    expect(blocked.status).toBe(409);
    expect(blocked.body.blockers).toContain('active sponsorship');

    const notAdmin = await request(app)
      .post(`/api/gdpr/erase/${sponsoredId}`)
      .set('Authorization', `Bearer ${director}`)
      .send({ reason: 'x', force: true });
    expect(notAdmin.status).toBe(403);
  });

  it('erases the person but keeps the row and its leave history', async () => {
    const res = await request(app)
      .post(`/api/gdpr/erase/${sponsoredId}`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ reason: 'Tribunal order', force: true });
    expect(res.status).toBe(200);
    expect(res.body.sponsorshipsDeleted).toBe(1);

    const row = await prisma.employee.findFirst({ where: { id: sponsoredId } });
    expect(row!.firstName).toBe('Former');
    expect(row!.email).toBe(`erased-${sponsoredId}@anonymised.invalid`);
    expect(row!.anonymisedAt).not.toBeNull();
    expect(await prisma.sponsorship.count({ where: { employeeId: sponsoredId } })).toBe(0);

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'ERASURE', entity: 'Employee', entityId: sponsoredId },
    });
    const details = JSON.parse(audit!.details);
    expect(details.reason).toBe('Tribunal order');
    expect(details.forced).toBe(true);

    const again = await request(app)
      .post(`/api/gdpr/erase/${sponsoredId}`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ reason: 'twice', force: true });
    expect(again.status).toBe(409);
  });

  it('the sweep anonymises expired leavers, deletes their login, and leaves the rest alone', async () => {
    const before = await prisma.employee.findFirst({ where: { id: leaverId } });
    expect(before!.anonymisedAt).toBeNull();

    const result = await runRetentionSweep(new Date('2026-09-01'));
    expect(result.errors).toEqual([]);
    expect(result.employeesAnonymised).toBeGreaterThanOrEqual(1);

    const after = await prisma.employee.findFirst({ where: { id: leaverId } });
    expect(after!.anonymisedAt).not.toBeNull();
    expect(after!.niNumber).toBeNull();
    expect(after!.phoneNumber).toBeNull();
    expect(after!.endDate?.toISOString().slice(0, 10)).toBe('2019-01-31');
    expect(await prisma.user.count({ where: { id: leaverUserId } })).toBe(0);
    expect(await prisma.leaveRequest.count({ where: { employeeId: leaverId } })).toBe(1);

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'ERASURE', entity: 'Employee', entityId: leaverId, userEmail: 'cron@system' },
    });
    expect(JSON.parse(audit!.details).reason).toBe('RETENTION_EXPIRED');

    // A leaver whose date is still in the future is untouched.
    const future = await prisma.employee.findFirst({
      where: { email: `newleaver@${PREFIX}.test` },
    });
    expect(future!.anonymisedAt).toBeNull();
  });

  it('purges soft-deleted tenants only once the grace period has run', async () => {
    const now = new Date('2026-09-01');
    const fresh = await platformPrisma.tenant.create({
      data: {
        slug: `${PREFIX}-purge-fresh`,
        name: 'Recently closed',
        status: 'CANCELLED',
        deletedAt: new Date(now.getTime() - 10 * DAY),
      },
    });
    const stale = await platformPrisma.tenant.create({
      data: {
        slug: `${PREFIX}-purge-stale`,
        name: 'Long gone',
        status: 'CANCELLED',
        deletedAt: new Date(now.getTime() - 45 * DAY),
      },
    });
    const orphan = await platformPrisma.employee.create({
      data: {
        tenantId: stale.id,
        firstName: 'Orphan',
        lastName: 'Row',
        email: `orphan@${PREFIX}.test`,
      },
    });
    // Sponsorship and User do not cascade from Employee; the purge must
    // clear them itself or the tenant delete is refused.
    await platformPrisma.sponsorship.create({
      data: {
        tenantId: stale.id,
        employeeId: orphan.id,
        visaType: 'Skilled Worker',
        startDate: new Date('2024-01-01'),
      },
    });
    await platformPrisma.user.create({
      data: {
        tenantId: stale.id,
        email: `orphan@${PREFIX}.test`,
        password: 'x',
        role: 'EMPLOYEE',
        employeeId: orphan.id,
      },
    });

    const result = await runRetentionSweep(now);
    expect(result.tenantsPurged).toBe(1);
    expect(await platformPrisma.tenant.count({ where: { id: stale.id } })).toBe(0);
    expect(await platformPrisma.tenant.count({ where: { id: fresh.id } })).toBe(1);
    expect(
      await platformPrisma.employee.count({ where: { email: `orphan@${PREFIX}.test` } }),
    ).toBe(0);
    const audit = await platformPrisma.auditLog.findFirst({
      where: { action: 'TENANT_PURGED', entityId: stale.id },
    });
    expect(audit).not.toBeNull();
    expect(testTenantId()).not.toBe(stale.id);
  });
});
