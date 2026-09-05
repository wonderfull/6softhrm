import { beforeAll, describe, expect, it } from '@jest/globals';
import express from 'express';
import request from './helpers/http';
import employeesRouter from '../routes/employees';
import { platformPrisma } from '../prismaClient';
import { testPrisma as prisma, signTestToken } from './helpers/tenantTest';
import { isEncrypted } from '../lib/fieldEncryption';
import { encryptExistingFields } from '../../scripts/encrypt-existing-fields';

const app = express();
app.use(express.json());
app.use('/api/employees', employeesRouter);

const SECRETS = {
  niNumber: 'QQ123456C',
  passportNumber: '987654321',
  accountNumber: '12345678',
  sortCode: '11-22-33',
};

type RawRow = {
  niNumber: string | null;
  passportNumber: string | null;
  accountNumber: string | null;
  sortCode: string | null;
};

// The only path in the codebase that sees the columns as they are actually
// stored — everything else goes through the decrypting client extension.
async function readRawColumns(id: number): Promise<RawRow> {
  const rows = await platformPrisma.$queryRaw<RawRow[]>`
    SELECT niNumber, passportNumber, accountNumber, sortCode FROM Employee WHERE id = ${id}
  `;
  return rows[0];
}

function expectStoredEncrypted(raw: RawRow) {
  for (const [field, plaintext] of Object.entries(SECRETS)) {
    const stored = raw[field as keyof RawRow];
    expect(isEncrypted(stored)).toBe(true);
    expect(stored).not.toContain(plaintext);
  }
}

describe('Employee sensitive column encryption', () => {
  let adminToken: string;

  beforeAll(async () => {
    const stale = await prisma.employee.findMany({
      where: { email: { contains: '@encryption.test' } },
      select: { id: true },
    });
    const staleIds = stale.map((e: { id: number }) => e.id);
    await prisma.leaveRequest.deleteMany({ where: { employeeId: { in: staleIds } } });
    await prisma.employee.deleteMany({ where: { id: { in: staleIds } } });
    adminToken = `Bearer ${signTestToken({ email: 'admin@encryption.test', role: 'ADMIN' })}`;
  });

  it('stores ciphertext but reads back plaintext', async () => {
    const created = await prisma.employee.create({
      data: {
        firstName: 'Round',
        lastName: 'Trip',
        email: 'roundtrip@encryption.test',
        employeeType: 'EMPLOYEE',
        ...SECRETS,
      },
    });
    expect(created).toMatchObject(SECRETS);

    expectStoredEncrypted(await readRawColumns(created.id));

    const reread = await prisma.employee.findFirst({
      where: { id: created.id },
    });
    expect(reread).toMatchObject(SECRETS);
  });

  it('re-encrypts on update and decrypts nested include reads', async () => {
    const employee = await prisma.employee.create({
      data: {
        firstName: 'Nested',
        lastName: 'Read',
        email: 'nested@encryption.test',
        employeeType: 'EMPLOYEE',
        ...SECRETS,
      },
    });
    await prisma.employee.updateMany({
      where: { id: employee.id },
      data: { niNumber: 'ZZ999999Z' },
    });
    const raw = await readRawColumns(employee.id);
    expect(isEncrypted(raw.niNumber)).toBe(true);
    expect(raw.niNumber).not.toContain('ZZ999999Z');

    await prisma.leaveRequest.create({
      data: {
        employeeId: employee.id,
        type: 'Annual Leave',
        startDate: new Date('2026-09-01'),
        endDate: new Date('2026-09-02'),
        status: 'PENDING',
      },
    });
    const leave = await prisma.leaveRequest.findMany({
      where: { employeeId: employee.id },
      include: { employee: true },
    });
    expect(leave[0].employee.niNumber).toBe('ZZ999999Z');
    expect(leave[0].employee.sortCode).toBe(SECRETS.sortCode);
  });

  it('round-trips through the create and update routes', async () => {
    const created = await request(app)
      .post('/api/employees')
      .set('Authorization', adminToken)
      .send({
        firstName: 'Route',
        lastName: 'Trip',
        email: 'route@encryption.test',
        employeeType: 'EMPLOYEE',
        ...SECRETS,
      });
    expect(created.status).toBe(200);
    expect(created.body).toMatchObject(SECRETS);
    expectStoredEncrypted(await readRawColumns(created.body.id));

    const updated = await request(app)
      .put(`/api/employees/${created.body.id}`)
      .set('Authorization', adminToken)
      .send({ accountNumber: '99998888' });
    expect(updated.status).toBe(200);
    expect(updated.body.accountNumber).toBe('99998888');
    expect(updated.body.niNumber).toBe(SECRETS.niNumber);

    const listed = await request(app)
      .get('/api/employees')
      .set('Authorization', adminToken);
    const row = listed.body.find((e: any) => e.id === created.body.id);
    expect(row.niNumber).toBe(SECRETS.niNumber);
    expect(row.passportNumber).toBe(SECRETS.passportNumber);
  });

  it('round-trips through the CSV importer', async () => {
    const csv = Buffer.from(
      [
        'First Name,Last Name,Email,NI Number,Passport Number',
        `Import,Trip,import@encryption.test,${SECRETS.niNumber},${SECRETS.passportNumber}`,
      ].join('\n'),
    );
    const res = await request(app)
      .post('/api/employees/import')
      .set('Authorization', adminToken)
      .attach('file', csv, 'employees.csv');
    expect(res.status).toBe(200);
    expect(res.body.summary.created).toBe(1);

    const imported = await prisma.employee.findFirst({
      where: { email: 'import@encryption.test' },
    });
    expect(imported.niNumber).toBe(SECRETS.niNumber);
    expect(imported.passportNumber).toBe(SECRETS.passportNumber);

    const raw = await readRawColumns(imported.id);
    expect(isEncrypted(raw.niNumber)).toBe(true);
    expect(raw.niNumber).not.toContain(SECRETS.niNumber);
    expect(isEncrypted(raw.passportNumber)).toBe(true);
  });

  it('refuses to filter on an encrypted column', async () => {
    await expect(
      prisma.employee.findFirst({ where: { niNumber: SECRETS.niNumber } }),
    ).rejects.toThrow('ENCRYPTED_FIELD_NOT_FILTERABLE');
  });

  describe('backfill script', () => {
    let legacyId: number;

    beforeAll(async () => {
      const employee = await prisma.employee.create({
        data: {
          firstName: 'Legacy',
          lastName: 'Plaintext',
          email: 'legacy@encryption.test',
          employeeType: 'EMPLOYEE',
        },
      });
      legacyId = employee.id;
      // Simulate a pre-encryption row: write plaintext straight into the columns.
      await platformPrisma.$executeRaw`
        UPDATE Employee
           SET niNumber = ${SECRETS.niNumber},
               passportNumber = ${SECRETS.passportNumber},
               accountNumber = ${SECRETS.accountNumber},
               sortCode = ${SECRETS.sortCode}
         WHERE id = ${legacyId}
      `;
    });

    it('encrypts plaintext rows and leaves the values readable', async () => {
      const before = await readRawColumns(legacyId);
      expect(before.niNumber).toBe(SECRETS.niNumber);

      const stats = await encryptExistingFields();
      expect(stats.rowsEncrypted).toBeGreaterThanOrEqual(1);
      expect(stats.fieldsEncrypted).toBeGreaterThanOrEqual(4);

      expectStoredEncrypted(await readRawColumns(legacyId));
      const employee = await prisma.employee.findFirst({
        where: { id: legacyId },
      });
      expect(employee).toMatchObject(SECRETS);
    });

    it('is idempotent — a second run changes nothing', async () => {
      const stored = await readRawColumns(legacyId);
      const stats = await encryptExistingFields();
      expect(stats.rowsEncrypted).toBe(0);
      expect(stats.fieldsEncrypted).toBe(0);
      expect(stats.fieldsAlreadyEncrypted).toBeGreaterThanOrEqual(4);
      expect(await readRawColumns(legacyId)).toEqual(stored);
    });
  });
});
