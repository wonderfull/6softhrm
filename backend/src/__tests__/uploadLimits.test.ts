import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from './helpers/http';
import app from '../app';
import {
  testPrisma as prisma,
  signTestToken,
  testTenantId,
} from './helpers/tenantTest';

// Deliberately the real app, not a bare router: the multer error handler that
// turns a rejected upload into a clean 4xx lives in app.ts, so a hand-rolled
// test app would silently miss it.

// The 5MB cap and the PDF/PNG/JPG/DOC allowlist are security controls, and
// neither had any coverage — so nothing would have noticed if a multer upgrade
// changed how a rejection surfaces, or if the limits stopped being enforced.

const pdf = (bytes: number) => Buffer.alloc(bytes, 0x25);

describe('document upload limits', () => {
  let employeeId: number;
  let token: string;

  beforeAll(async () => {
    await prisma.document.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.employee.deleteMany({});

    const employee = await prisma.employee.create({
      data: {
        tenantId: testTenantId(),
        firstName: 'Upload',
        lastName: 'Target',
        email: 'upload@limits.test',
        employeeType: 'EMPLOYEE',
      },
    });
    employeeId = employee.id;
    token = `Bearer ${signTestToken({ email: 'admin@limits.test', role: 'ADMIN' })}`;
  });

  afterAll(async () => {
    await prisma.document.deleteMany({});
    await prisma.employee.deleteMany({});
    await prisma.$disconnect();
  });

  const upload = (buffer: Buffer, filename: string, contentType: string) =>
    request(app)
      .post('/api/documents/upload')
      .set('Authorization', token)
      .field('employeeId', String(employeeId))
      .field('name', 'Test upload')
      .attach('file', buffer, { filename, contentType });

  it('accepts a small PDF', async () => {
    const res = await upload(pdf(1024), 'ok.pdf', 'application/pdf');
    expect(res.status).toBe(200);
  });

  it('refuses a disallowed content type', async () => {
    // fileFilter calls cb(null, false), so multer drops the file silently and
    // the route sees no file at all.
    const res = await upload(
      Buffer.from('#!/bin/sh\n'),
      'evil.sh',
      'application/x-sh',
    );
    expect(res.status).toBe(400);
    expect(res.status).not.toBe(200);
  });

  it('refuses a file over the 5MB cap without a 500', async () => {
    const res = await upload(
      pdf(6 * 1024 * 1024),
      'big.pdf',
      'application/pdf',
    );
    // The file must not be stored. A 500 here means the MulterError escaped to
    // Express's default handler instead of being turned into a clean refusal.
    expect(res.status).not.toBe(200);
    expect(res.status).toBeLessThan(500);
  });

  it('stores nothing for either rejected upload', async () => {
    const stored = await prisma.document.findMany({
      where: { employeeId, name: 'Test upload' },
    });
    // Only the one legitimate small PDF from the first test.
    expect(stored.length).toBe(1);
  });
});
