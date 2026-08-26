import { describe, it, expect, beforeAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import employeesRouter from '../routes/employees';
import { testPrisma as prisma, signTestToken, testTenantId } from './helpers/tenantTest';
import { platformPrisma } from '../prismaClient';

const app = express();
app.use(express.json());
app.use('/api/employees', employeesRouter);

const csv = (rows: string[]) =>
  Buffer.from(['First Name,Last Name,Email,Job Title,Start Date', ...rows].join('\n'));

describe('Employee CSV import', () => {
  let adminToken: string;

  beforeAll(async () => {
    await prisma.leaveRequest.deleteMany({});
    await prisma.timesheet.deleteMany({});
    await prisma.document.deleteMany({});
    await prisma.sponsorship.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.employee.deleteMany({});
    adminToken = `Bearer ${signTestToken({ email: 'admin@import.test', role: 'ADMIN' })}`;
  });

  it('serves a CSV template', async () => {
    const res = await request(app)
      .get('/api/employees/import/template')
      .set('Authorization', adminToken);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('First Name,Last Name,Email');
  });

  it('rejects files missing required columns', async () => {
    const res = await request(app)
      .post('/api/employees/import?dryRun=true')
      .set('Authorization', adminToken)
      .attach('file', Buffer.from('Nickname\nDave'), 'bad.csv');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Missing required column');
  });

  it('dry run classifies rows without writing anything', async () => {
    const res = await request(app)
      .post('/api/employees/import?dryRun=true')
      .set('Authorization', adminToken)
      .attach(
        'file',
        csv([
          'Ada,Lovelace,ada@import.test,Engineer,2026-01-05',
          'Bad,Row,not-an-email,Engineer,2026-01-05',
          'No,Email,,Engineer,2026-01-05',
          'Dup,One,dup@import.test,Engineer,2026-01-05',
          'Dup,Two,dup@import.test,Engineer,2026-01-05',
        ]),
        'people.csv',
      );
    expect(res.status).toBe(200);
    expect(res.body.dryRun).toBe(true);
    expect(res.body.summary).toMatchObject({ total: 5, creates: 2, errors: 3 });
    expect(await prisma.employee.count()).toBe(0);
  });

  it('commit creates then updates idempotently by email', async () => {
    const first = await request(app)
      .post('/api/employees/import')
      .set('Authorization', adminToken)
      .attach(
        'file',
        csv(['Ada,Lovelace,ada@import.test,Engineer,2026-01-05', 'Grace,Hopper,grace@import.test,Admiral,05/01/2026']),
        'people.csv',
      );
    expect(first.status).toBe(200);
    expect(first.body.summary).toMatchObject({ created: 2, updated: 0 });

    const second = await request(app)
      .post('/api/employees/import')
      .set('Authorization', adminToken)
      .attach(
        'file',
        csv(['Ada,Lovelace,ada@import.test,Principal Engineer,2026-01-05']),
        'people.csv',
      );
    expect(second.status).toBe(200);
    expect(second.body.summary).toMatchObject({ created: 0, updated: 1 });

    const ada = await prisma.employee.findFirst({ where: { email: 'ada@import.test' } });
    expect(ada.jobTitle).toBe('Principal Engineer');
    // UK date format parsed correctly
    const grace = await prisma.employee.findFirst({ where: { email: 'grace@import.test' } });
    expect(new Date(grace.startDate).toISOString().slice(0, 10)).toBe('2026-01-05');
    expect(await prisma.employee.count()).toBe(2);
  });

  it('enforces the tenant seat limit on net creates', async () => {
    await platformPrisma.tenant.update({
      where: { id: testTenantId() },
      data: { seatLimit: 3 },
    });
    const res = await request(app)
      .post('/api/employees/import')
      .set('Authorization', adminToken)
      .attach(
        'file',
        csv(['New,One,one@import.test,X,2026-01-05', 'New,Two,two@import.test,X,2026-01-05']),
        'people.csv',
      );
    expect(res.status).toBe(402);
    expect(res.body.code).toBe('SEAT_LIMIT_REACHED');
    // nothing partially imported
    expect(await prisma.employee.count()).toBe(2);
    await platformPrisma.tenant.update({
      where: { id: testTenantId() },
      data: { seatLimit: null },
    });
  });

  it('rejects import for non-admin roles', async () => {
    const res = await request(app)
      .post('/api/employees/import')
      .set('Authorization', `Bearer ${signTestToken({ email: 'user@import.test', role: 'EMPLOYEE' })}`)
      .attach('file', csv(['A,B,ab@import.test,X,2026-01-05']), 'people.csv');
    expect(res.status).toBe(403);
  });
});
