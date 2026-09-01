import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import * as XLSX from 'xlsx';
import mysql from 'mysql2/promise';
// The real app, not a hand-rolled router harness: upload-size failures are
// only handled correctly when the full middleware chain is in play.
import app from '../app';
import {
  testPrisma as prisma,
  signTestToken,
  testTenantId,
} from './helpers/tenantTest';
import { platformPrisma } from '../prismaClient';
import { parseImportFile } from '../lib/employeeImport';
import { parsePayImportFile } from '../lib/payImport';

const empCsv = (rows: string[]) =>
  Buffer.from(
    ['First Name,Last Name,Email,Job Title,Start Date', ...rows].join('\n'),
  );
const payCsv = (rows: string[]) =>
  Buffer.from(
    ['Email,Period Start,Period End,Gross Pay,Hours Worked', ...rows].join(
      '\n',
    ),
  );

const postImport = (
  path: string,
  token: string,
  buf: Buffer,
  filename = 'import.csv',
) =>
  request(app)
    .post(path)
    .set('Authorization', token)
    .attach('file', buf, filename);

async function cleanTenantData() {
  await prisma.payRecord.deleteMany({});
  await prisma.absenceRecord.deleteMany({});
  await prisma.sponsorship.deleteMany({});
  await prisma.leaveRequest.deleteMany({});
  await prisma.timesheet.deleteMany({});
  await prisma.document.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.employee.deleteMany({});
}

describe('import failure modes', () => {
  let adminToken: string;

  beforeAll(async () => {
    await cleanTenantData();
    adminToken = `Bearer ${signTestToken({ email: 'admin@failmodes.test', role: 'ADMIN' })}`;
  });

  describe('malformed files (clean 400, nothing written)', () => {
    const garbage = Buffer.from(
      Array.from({ length: 512 }, (_, i) => (i * 37 + 11) % 256),
    );
    // A ZIP local-file-header signature followed by noise: XLSX.read throws
    // on this instead of returning an unusable workbook.
    const corruptZip = Buffer.concat([
      Buffer.from('PK\x03\x04'),
      Buffer.from(Array.from({ length: 256 }, (_, i) => (i * 53) % 256)),
    ]);

    const cases: Array<[string, Buffer, string]> = [
      ['binary garbage', garbage, 'noise.csv'],
      ['empty 0-byte file', Buffer.alloc(0), 'empty.csv'],
      ['corrupt zip posing as xlsx', corruptZip, 'report.xlsx'],
    ];

    for (const [label, buf, filename] of cases) {
      it(`employee import rejects ${label} with a 400`, async () => {
        const res = await postImport(
          '/api/employees/import',
          adminToken,
          buf,
          filename,
        );
        expect(res.status).toBe(400);
        expect(typeof res.body.error).toBe('string');
        expect(await prisma.employee.count()).toBe(0);
      });

      it(`pay import rejects ${label} with a 400`, async () => {
        const res = await postImport(
          '/api/pay/import',
          adminToken,
          buf,
          filename,
        );
        expect(res.status).toBe(400);
        expect(typeof res.body.error).toBe('string');
        expect(await prisma.payRecord.count()).toBe(0);
      });
    }

    it('employee import rejects a headers-only file with a 400', async () => {
      const res = await postImport(
        '/api/employees/import',
        adminToken,
        Buffer.from('First Name,Last Name,Email\n'),
      );
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/no data rows/i);
      expect(await prisma.employee.count()).toBe(0);
    });

    it('pay import rejects a headers-only file with a 400', async () => {
      const res = await postImport(
        '/api/pay/import',
        adminToken,
        Buffer.from('Email,Period Start,Period End,Gross Pay\n'),
      );
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/no data rows/i);
      expect(await prisma.payRecord.count()).toBe(0);
    });
  });

  describe('xlsx whose first sheet is empty', () => {
    const workbookWithEmptyFirstSheet = (headers: string[], row: string[]) => {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[]]), 'Cover');
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([headers, row]),
        'Data',
      );
      return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    };

    it('employee import says the data is on another sheet, not "no data"', async () => {
      const buf = workbookWithEmptyFirstSheet(
        ['First Name', 'Last Name', 'Email'],
        ['Ada', 'Lovelace', 'ada@sheets.test'],
      );
      const res = await postImport(
        '/api/employees/import',
        adminToken,
        buf,
        'people.xlsx',
      );
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/first sheet/i);
      expect(res.body.error).toContain('Data');
      expect(await prisma.employee.count()).toBe(0);
    });

    it('pay import says the data is on another sheet, not "no data"', async () => {
      const buf = workbookWithEmptyFirstSheet(
        ['Email', 'Period Start', 'Period End', 'Gross Pay'],
        ['a@sheets.test', '2026-01-01', '2026-01-31', '2500'],
      );
      const res = await postImport(
        '/api/pay/import',
        adminToken,
        buf,
        'payroll.xlsx',
      );
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/first sheet/i);
      expect(res.body.error).toContain('Data');
      expect(await prisma.payRecord.count()).toBe(0);
    });
  });

  describe('non-finite numbers are row errors, not import crashes', () => {
    const hugeNumber = '9'.repeat(400); // Number(...) === Infinity

    it('employee import flags an astronomically large salary at parse time', () => {
      const { rows } = parseImportFile(
        Buffer.from(
          `First Name,Last Name,Email,Salary\nA,B,ab@x.test,${hugeNumber}\n`,
        ),
      );
      expect(rows[0].errors.join(' ')).toMatch(/salary/i);
      expect(rows[0].data.salary).toBeUndefined();
    });

    it('pay import flags an astronomically large gross pay at parse time', () => {
      const { rows } = parsePayImportFile(
        Buffer.from(
          `Email,Period Start,Period End,Gross Pay\na@b.test,2026-01-01,2026-01-31,${hugeNumber}\n`,
        ),
      );
      expect(rows[0].errors.join(' ')).toMatch(/gross/i);
      expect(rows[0].data.grossPay).toBeUndefined();
    });
  });

  describe('commit atomicity — a mid-batch failure must import nothing', () => {
    it('employee commit rolls back every row when one insert fails', async () => {
      await cleanTenantData();
      // The 500-character name passes parsing but exceeds the VARCHAR(191)
      // column, so the database rejects it on the third insert of three.
      const res = await postImport(
        '/api/employees/import',
        adminToken,
        empCsv([
          'Good,One,good.one@atomic.test,Engineer,2026-01-05',
          'Good,Two,good.two@atomic.test,Engineer,2026-01-05',
          `${'X'.repeat(500)},Boom,boom@atomic.test,Engineer,2026-01-05`,
        ]),
      );
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/no rows were imported/i);
      expect(await prisma.employee.count()).toBe(0);
    });

    it('pay commit rolls back every row when the database fails mid-batch', async () => {
      await cleanTenantData();
      await prisma.employee.create({
        data: {
          firstName: 'Alice',
          lastName: 'Atomic',
          email: 'alice@atomic.test',
        },
      });

      // Simulate the database failing on the last row of the batch (as a
      // constraint violation or dropped connection would) with a trigger.
      // DDL goes through mysql2 directly: MySQL refuses CREATE TRIGGER over
      // the prepared-statement protocol Prisma uses (error 1295).
      const dbUrl = new URL(
        process.env.TEST_DATABASE_URL || process.env.DATABASE_URL!,
      );
      const conn = await mysql.createConnection({
        host: dbUrl.hostname,
        port: Number(dbUrl.port || 3306),
        user: decodeURIComponent(dbUrl.username),
        password: decodeURIComponent(dbUrl.password),
        database: dbUrl.pathname.slice(1),
      });
      try {
        await conn.query('DROP TRIGGER IF EXISTS test_fail_pay_insert');
        await conn.query(`
          CREATE TRIGGER test_fail_pay_insert BEFORE INSERT ON PayRecord
          FOR EACH ROW
          BEGIN
            IF NEW.grossPay = 13371337 THEN
              SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'forced failure (test)';
            END IF;
          END
        `);

        const res = await postImport(
          '/api/pay/import',
          adminToken,
          payCsv([
            'alice@atomic.test,2026-01-01,2026-01-31,2500,160',
            'alice@atomic.test,2026-02-01,2026-02-28,2500,160',
            'alice@atomic.test,2026-03-01,2026-03-31,13371337,160',
          ]),
        );
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/no rows were imported/i);
        expect(await prisma.payRecord.count()).toBe(0);
      } finally {
        await conn.query('DROP TRIGGER IF EXISTS test_fail_pay_insert');
        await conn.end();
      }
    });
  });

  describe('pay import is idempotent by (employee, period start)', () => {
    beforeAll(async () => {
      await cleanTenantData();
      await prisma.employee.create({
        data: { firstName: 'Bob', lastName: 'Payee', email: 'bob@import.test' },
      });
    });

    it('imports the same file twice: creates then updates, never duplicates', async () => {
      const first = await postImport(
        '/api/pay/import',
        adminToken,
        payCsv([
          'bob@import.test,2026-01-01,2026-01-31,2500,160',
          'bob@import.test,2026-02-01,2026-02-28,2600,152',
        ]),
      );
      expect(first.status).toBe(200);
      expect(first.body).toMatchObject({ created: 2, updated: 0 });

      const second = await postImport(
        '/api/pay/import',
        adminToken,
        payCsv([
          'bob@import.test,2026-01-01,2026-01-31,2500,160',
          'bob@import.test,2026-02-01,2026-02-28,2700,152',
        ]),
      );
      expect(second.status).toBe(200);
      expect(second.body).toMatchObject({ created: 0, updated: 2 });

      expect(await prisma.payRecord.count()).toBe(2);
      const feb = await prisma.payRecord.findFirst({
        where: { periodStart: new Date('2026-02-01T00:00:00.000Z') },
      });
      expect(feb.grossPay).toBe(2700);
    });
  });

  describe('pay import cannot reach an employee in another tenant', () => {
    let otherTenantId: number;

    beforeAll(async () => {
      await cleanTenantData();
      const other = await platformPrisma.tenant.upsert({
        where: { slug: 'test-importfailuremodes-other' },
        update: {},
        create: {
          slug: 'test-importfailuremodes-other',
          name: 'Other Tenant',
          status: 'ACTIVE',
          plan: 'CORE_PLUS_COMPLIANCE',
          features: { compliance: true },
        },
      });
      otherTenantId = other.id;
      await platformPrisma.payRecord.deleteMany({
        where: { tenantId: otherTenantId },
      });
      await platformPrisma.employee.deleteMany({
        where: { tenantId: otherTenantId },
      });
      await platformPrisma.employee.create({
        data: {
          tenantId: otherTenantId,
          firstName: 'Ghost',
          lastName: 'Elsewhere',
          email: 'ghost@other.tenant',
        },
      });
    });

    it('reports a row error and writes nothing anywhere', async () => {
      const res = await postImport(
        '/api/pay/import',
        adminToken,
        payCsv(['ghost@other.tenant,2026-01-01,2026-01-31,2500,160']),
      );
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ created: 0, updated: 0 });
      expect(res.body.summary.errors).toBe(1);

      // Not in this tenant, and — checked platform-wide — not in the other
      // tenant either.
      expect(
        await platformPrisma.payRecord.count({
          where: { employee: { email: 'ghost@other.tenant' } },
        }),
      ).toBe(0);
    });
  });

  describe('seat limit during employee import', () => {
    beforeAll(async () => {
      await cleanTenantData();
      await prisma.employee.create({
        data: {
          firstName: 'Seat',
          lastName: 'One',
          email: 'seat.one@import.test',
        },
      });
      await prisma.employee.create({
        data: {
          firstName: 'Seat',
          lastName: 'Two',
          email: 'seat.two@import.test',
        },
      });
      await platformPrisma.tenant.update({
        where: { id: testTenantId() },
        data: { seatLimit: 2 },
      });
    });

    afterAll(async () => {
      await platformPrisma.tenant.update({
        where: { id: testTenantId() },
        data: { seatLimit: null },
      });
    });

    it('allows a file of pure updates at a full seat limit', async () => {
      const res = await postImport(
        '/api/employees/import',
        adminToken,
        empCsv([
          'Seat,One,seat.one@import.test,Updated Title,2026-01-05',
          'Seat,Two,seat.two@import.test,Updated Title,2026-01-05',
        ]),
      );
      expect(res.status).toBe(200);
      expect(res.body.summary).toMatchObject({ created: 0, updated: 2 });
    });

    it('402s a file whose creates exceed the free seats, writing nothing — not even its updates', async () => {
      const res = await postImport(
        '/api/employees/import',
        adminToken,
        empCsv([
          'Seat,One,seat.one@import.test,Should Not Land,2026-01-05',
          'New,Hire,new.hire@import.test,Engineer,2026-01-05',
        ]),
      );
      expect(res.status).toBe(402);
      expect(res.body.code).toBe('SEAT_LIMIT_REACHED');
      expect(await prisma.employee.count()).toBe(2);
      const one = await prisma.employee.findFirst({
        where: { email: 'seat.one@import.test' },
      });
      expect(one.jobTitle).toBe('Updated Title');
    });
  });

  describe('oversized upload', () => {
    const big = Buffer.alloc(2 * 1024 * 1024 + 1024, 97); // just past the 2MB cap

    it('employee import answers 413, not a 500', async () => {
      const res = await postImport(
        '/api/employees/import',
        adminToken,
        big,
        'big.csv',
      );
      expect(res.status).toBe(413);
      expect(res.body.error).toMatch(/2MB/);
    });

    it('pay import answers 413, not a 500', async () => {
      const res = await postImport(
        '/api/pay/import',
        adminToken,
        big,
        'big.csv',
      );
      expect(res.status).toBe(413);
      expect(res.body.error).toMatch(/2MB/);
    });
  });
});
