import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import * as XLSX from 'xlsx';
import gdprRouter from '../routes/gdpr';
import {
  testPrisma as prisma,
  signTestToken,
  testTenantId,
} from './helpers/tenantTest';

const app = express();
app.use(express.json());
app.use('/api/gdpr', gdprRouter);

// A subject access request must return the person's actual data. Now that NI,
// passport and bank details are encrypted at rest, a SAR that handed back
// `enc:v1:…` would satisfy nobody and would be an Article 15 failure — the
// data subject is entitled to their data in intelligible form. These fields
// pass through the decrypting client, but nothing asserted it until now.

const NI = 'QQ123456C';
const PASSPORT = '533401234';
const ACCOUNT = '12345678';
const SORT = '20-00-00';

describe('GDPR export decrypts sensitive fields', () => {
  let employeeId: number;
  let adminToken: string;

  beforeAll(async () => {
    await prisma.document.deleteMany({});
    await prisma.timesheet.deleteMany({});
    await prisma.leaveRequest.deleteMany({});
    await prisma.sponsorship.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.employee.deleteMany({});

    const employee = await prisma.employee.create({
      data: {
        tenantId: testTenantId(),
        firstName: 'Sar',
        lastName: 'Subject',
        email: 'sar@gdpr.test',
        employeeType: 'EMPLOYEE',
        niNumber: NI,
        passportNumber: PASSPORT,
        accountNumber: ACCOUNT,
        sortCode: SORT,
        bankName: 'Test Bank',
      },
    });
    employeeId = employee.id;
    adminToken = `Bearer ${signTestToken({ email: 'admin@gdpr.test', role: 'ADMIN' })}`;
  });

  afterAll(async () => {
    await prisma.employee.deleteMany({});
    await prisma.$disconnect();
  });

  it('stores the fields encrypted in the first place', async () => {
    // testPrisma is deliberately loosely typed, so no type argument here.
    const rows: any[] = await prisma.$queryRawUnsafe(
      'SELECT niNumber, accountNumber FROM Employee WHERE id = ?',
      employeeId,
    );
    const row = rows[0];
    expect(String(row.niNumber)).toMatch(/^enc:v1:/);
    expect(String(row.niNumber)).not.toContain(NI);
    expect(String(row.accountNumber)).not.toContain(ACCOUNT);
  });

  it('returns readable values in the JSON subject access request', async () => {
    const res = await request(app)
      .get(`/api/gdpr/subject-access-request/${employeeId}`)
      .set('Authorization', adminToken);

    expect(res.status).toBe(200);
    const body = JSON.stringify(res.body);
    expect(body).toContain(NI);
    expect(body).toContain(PASSPORT);
    expect(body).not.toContain('enc:v1:');
  });

  it('returns readable values in the XLSX export', async () => {
    const res = await request(app)
      .get(`/api/gdpr/export-employee-data/${employeeId}`)
      .set('Authorization', adminToken)
      .buffer(true)
      .parse((response, cb) => {
        const chunks: Buffer[] = [];
        response.on('data', (c: Buffer) => chunks.push(c));
        response.on('end', () => cb(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    const wb = XLSX.read(res.body as Buffer, { type: 'buffer' });
    const sheet = wb.Sheets['Personal Data'];
    const [row] = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

    expect(row['NI Number']).toBe(NI);
    expect(row['Sort Code']).toBe(SORT);
    expect(row['Account Number']).toBe(ACCOUNT);
    // Belt and braces: no ciphertext anywhere in the workbook.
    expect(JSON.stringify(row)).not.toContain('enc:v1:');
  });
});
