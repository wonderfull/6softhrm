import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import express from 'express';
import request from './helpers/http';
import tenantRouter from '../routes/tenant';
import sponsorshipsRouter from '../routes/sponsorships';
import { platformPrisma } from '../prismaClient';
import {
  testPrisma as prisma,
  signTestToken,
  testTenantId,
} from './helpers/tenantTest';

// The sponsor licence is one row per tenant: readable by everyone who works
// the compliance screens, writable by the owner only, and the source of the
// licence number and CoS allocation figures the sponsorship screens use.

const app = express();
app.use(express.json());
app.use('/api/tenant', tenantRouter);
app.use('/api/sponsorships', sponsorshipsRouter);

const PREFIX = 'lic';

describe('Sponsor licence', () => {
  let admin: string;
  let director: string;
  let employee: string;
  let employeeId: number;

  async function cleanup() {
    const stale = await prisma.employee.findMany({
      where: { email: { contains: `@${PREFIX}.test` } },
      select: { id: true },
    });
    const ids = stale.map((e: { id: number }) => e.id);
    if (ids.length) {
      await prisma.sponsorship.deleteMany({ where: { employeeId: { in: ids } } });
      await prisma.employee.deleteMany({ where: { id: { in: ids } } });
    }
    await platformPrisma.sponsorLicence.deleteMany({
      where: { tenantId: testTenantId() },
    });
  }

  beforeAll(async () => {
    await cleanup();
    const worker = await prisma.employee.create({
      data: { firstName: 'Cos', lastName: 'Holder', email: `worker@${PREFIX}.test` },
    });
    employeeId = worker.id;
    admin = signTestToken({ email: `admin@${PREFIX}.test`, role: 'ADMIN' });
    director = signTestToken({ email: `director@${PREFIX}.test`, role: 'DIRECTOR' });
    employee = signTestToken({
      email: `worker@${PREFIX}.test`,
      role: 'EMPLOYEE',
      employeeId,
    });
  });

  afterAll(cleanup);

  it('is hidden from workers and read-only for directors', async () => {
    const read = await request(app)
      .get('/api/tenant/licence')
      .set('Authorization', `Bearer ${employee}`);
    expect(read.status).toBe(403);

    const write = await request(app)
      .put('/api/tenant/licence')
      .set('Authorization', `Bearer ${director}`)
      .send({ licenceNumber: 'NOPE' });
    expect(write.status).toBe(403);
  });

  it('reads as empty before anything is saved', async () => {
    const res = await request(app)
      .get('/api/tenant/licence')
      .set('Authorization', `Bearer ${director}`);
    expect(res.status).toBe(200);
    expect(res.body.licence).toBeNull();
    expect(res.body.cosDefinedUsed).toBe(0);
  });

  it('validates what it is given', async () => {
    const rating = await request(app)
      .put('/api/tenant/licence')
      .set('Authorization', `Bearer ${admin}`)
      .send({ rating: 'C' });
    expect(rating.status).toBe(400);
    const alloc = await request(app)
      .put('/api/tenant/licence')
      .set('Authorization', `Bearer ${admin}`)
      .send({ cosDefinedAllocated: -1 });
    expect(alloc.status).toBe(400);
    const empty = await request(app)
      .put('/api/tenant/licence')
      .set('Authorization', `Bearer ${admin}`)
      .send({});
    expect(empty.status).toBe(400);
  });

  it('the owner creates the row on first save and it is audited', async () => {
    const res = await request(app)
      .put('/api/tenant/licence')
      .set('Authorization', `Bearer ${admin}`)
      .send({
        licenceNumber: 'ABC123',
        rating: 'B',
        expiryDate: '2028-04-01',
        authorisingOfficer: 'Ada Lovelace',
        level1Users: [{ name: 'Grace', email: 'grace@example.com' }, { name: '', email: '' }],
        cosDefinedAllocated: 3,
        cosUndefinedAllocated: 5,
        allocationYearStart: '2026-04-06',
        actionPlanDueAt: '2026-12-01',
      });
    expect(res.status).toBe(200);
    expect(res.body.licence.licenceNumber).toBe('ABC123');
    expect(res.body.licence.rating).toBe('B');
    expect(res.body.licence.level1Users).toEqual([
      { name: 'Grace', email: 'grace@example.com' },
    ]);

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'UPDATE', entity: 'SponsorLicence', entityId: res.body.licence.id },
    });
    expect(audit).not.toBeNull();
  });

  it('a new sponsorship inherits the licence number and a start-by date 3 months after CoS assignment', async () => {
    const res = await request(app)
      .post('/api/sponsorships')
      .set('Authorization', `Bearer ${admin}`)
      .send({
        employeeId,
        visaType: 'Skilled Worker',
        startDate: '2026-06-01',
        cosType: 'DEFINED',
        cosAssignedDate: '2026-05-01',
        iscAmount: '1000',
      });
    expect(res.status).toBe(200);
    expect(res.body.sponsorLicenseNumber).toBe('ABC123');
    expect(res.body.cosStartBy.slice(0, 10)).toBe('2026-08-01');
    expect(res.body.iscAmount).toBe(1000);

    const bad = await request(app)
      .post('/api/sponsorships')
      .set('Authorization', `Bearer ${admin}`)
      .send({ employeeId, visaType: 'Skilled Worker', startDate: '2026-06-01', cosType: 'MAYBE' });
    expect(bad.status).toBe(400);
  });

  it('counts CoS used since the allocation year started', async () => {
    // Assigned before the allocation year: must not count.
    await prisma.sponsorship.create({
      data: {
        employeeId,
        visaType: 'Skilled Worker',
        startDate: new Date('2025-06-01'),
        cosType: 'DEFINED',
        cosAssignedDate: new Date('2025-05-01'),
      },
    });
    const res = await request(app)
      .get('/api/tenant/licence')
      .set('Authorization', `Bearer ${director}`);
    expect(res.body.cosDefinedUsed).toBe(1);
    expect(res.body.cosUndefinedUsed).toBe(0);
  });

  it('clearing the licence number on a sponsorship falls back to the licence', async () => {
    const list = await request(app)
      .get('/api/sponsorships')
      .set('Authorization', `Bearer ${admin}`);
    const target = list.body.find((s: any) => s.employeeId === employeeId);
    const res = await request(app)
      .put(`/api/sponsorships/${target.id}`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ sponsorLicenseNumber: '' });
    expect(res.status).toBe(200);
    expect(res.body.sponsorLicenseNumber).toBe('ABC123');
  });
});
