import { describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import { platformPrisma } from '../prismaClient';
import { encryptExistingFields } from '../../scripts/encrypt-existing-fields';
import { isEncrypted } from '../lib/fieldEncryption';

// Reproduces the actual deployment sequence, which the unit tests cannot:
// a database already holding plaintext written by the PRE-encryption code,
// then the new code deployed on top of it, then the backfill run against it.
// Rows are seeded with raw SQL precisely because every path through the client
// now encrypts — seeding through Prisma would not produce a legacy row.

const NI = 'QQ123456C';
const PASSPORT = '533401234';
const ACCOUNT = '12345678';
const SORT = '20-00-00';

type RawRow = {
  id: number;
  niNumber: string | null;
  passportNumber: string | null;
  accountNumber: string | null;
  sortCode: string | null;
};

async function tenantId(): Promise<number> {
  const existing = await platformPrisma.tenant.findFirst({
    where: { slug: 'backfill-deployment' },
  });
  if (existing) return existing.id;
  const created = await platformPrisma.tenant.create({
    data: { slug: 'backfill-deployment', name: 'Backfill Deployment' },
  });
  return created.id;
}

/** Inserts a row the way the old, pre-encryption code would have. */
async function seedLegacyRow(
  email: string,
  values: {
    ni?: string | null;
    passport?: string | null;
    account?: string | null;
    sort?: string | null;
  },
) {
  const t = await tenantId();
  await platformPrisma.$executeRawUnsafe(
    `INSERT INTO Employee (tenantId, firstName, lastName, email, niNumber, passportNumber, accountNumber, sortCode)
     VALUES (?, 'Legacy', 'Row', ?, ?, ?, ?, ?)`,
    t,
    email,
    values.ni ?? null,
    values.passport ?? null,
    values.account ?? null,
    values.sort ?? null,
  );
}

const rawRows = () =>
  platformPrisma.$queryRaw<RawRow[]>`
    SELECT id, niNumber, passportNumber, accountNumber, sortCode FROM Employee ORDER BY id
  `;

describe('encryption backfill — real deployment sequence', () => {
  // The backfill is deliberately global, so its stats only mean anything
  // against an empty table. Children first — other suites leave rows that
  // still reference Employee.
  const clearEmployees = async () => {
    await platformPrisma.payRecord.deleteMany({});
    await platformPrisma.absenceRecord.deleteMany({});
    await platformPrisma.sponsorshipComplianceEvidence.deleteMany({});
    await platformPrisma.sponsorshipReportableEvent.deleteMany({});
    await platformPrisma.sponsorship.deleteMany({});
    await platformPrisma.leaveRequest.deleteMany({});
    await platformPrisma.timesheet.deleteMany({});
    await platformPrisma.document.deleteMany({});
    await platformPrisma.dataConsent.deleteMany({});
    await platformPrisma.user.deleteMany({});
    await platformPrisma.employee.deleteMany({});
  };

  beforeEach(clearEmployees);

  afterAll(async () => {
    await clearEmployees();
    await platformPrisma.tenant.deleteMany({
      where: { slug: 'backfill-deployment' },
    });
  });

  it('reads legacy plaintext rows correctly BEFORE the backfill runs', async () => {
    await seedLegacyRow('pre@backfill.test', { ni: NI, passport: PASSPORT });

    // This is what the app does on the first boot after deploying the new code
    // but before the backfill: the row must stay readable, not blow up.
    const employee = await platformPrisma.employee.findFirst({
      where: { email: 'pre@backfill.test' },
    });
    expect(employee?.niNumber).toBe(NI);
    expect(employee?.passportNumber).toBe(PASSPORT);
  });

  it('dry run counts the work without writing anything', async () => {
    await seedLegacyRow('dry@backfill.test', { ni: NI, account: ACCOUNT });

    const stats = await encryptExistingFields({ dryRun: true });
    expect(stats.rowsEncrypted).toBe(1);
    expect(stats.fieldsEncrypted).toBe(2);

    const [row] = await rawRows();
    expect(isEncrypted(row.niNumber)).toBe(false);
    expect(row.niNumber).toBe(NI);
  });

  it('encrypts legacy rows and leaves them readable', async () => {
    await seedLegacyRow('real@backfill.test', {
      ni: NI,
      passport: PASSPORT,
      account: ACCOUNT,
      sort: SORT,
    });

    const stats = await encryptExistingFields();
    expect(stats.rowsEncrypted).toBe(1);
    expect(stats.fieldsEncrypted).toBe(4);

    const [raw] = await rawRows();
    for (const value of [
      raw.niNumber,
      raw.passportNumber,
      raw.accountNumber,
      raw.sortCode,
    ]) {
      expect(isEncrypted(value)).toBe(true);
    }
    expect(raw.niNumber).not.toContain(NI);

    const employee = await platformPrisma.employee.findFirst({
      where: { email: 'real@backfill.test' },
    });
    expect(employee?.niNumber).toBe(NI);
    expect(employee?.sortCode).toBe(SORT);
  });

  it('is idempotent — a second run encrypts nothing further', async () => {
    await seedLegacyRow('idem@backfill.test', { ni: NI, passport: PASSPORT });
    await encryptExistingFields();
    const [afterFirst] = await rawRows();

    const second = await encryptExistingFields();
    expect(second.rowsEncrypted).toBe(0);
    expect(second.fieldsEncrypted).toBe(0);
    expect(second.fieldsAlreadyEncrypted).toBe(2);

    // Byte-identical: a re-run must not churn the ciphertext, or every run
    // would rewrite every row and dirty an otherwise-stable backup diff.
    const [afterSecond] = await rawRows();
    expect(afterSecond.niNumber).toBe(afterFirst.niNumber);
  });

  it('resumes correctly after an interrupted run (mixed plaintext and ciphertext)', async () => {
    await seedLegacyRow('done@backfill.test', { ni: NI });
    await encryptExistingFields();
    // A second legacy row arrives, e.g. the first run died partway.
    await seedLegacyRow('pending@backfill.test', { ni: NI, account: ACCOUNT });

    const stats = await encryptExistingFields();
    expect(stats.rowsEncrypted).toBe(1);
    expect(stats.fieldsEncrypted).toBe(2);
    expect(stats.fieldsAlreadyEncrypted).toBe(1);

    const rows = await rawRows();
    expect(
      rows.every((r) => r.niNumber === null || isEncrypted(r.niNumber)),
    ).toBe(true);
  });

  it('leaves NULL and empty columns alone', async () => {
    await seedLegacyRow('sparse@backfill.test', {
      ni: null,
      passport: '',
      account: ACCOUNT,
    });

    const stats = await encryptExistingFields();
    expect(stats.fieldsEncrypted).toBe(1);

    const [raw] = await rawRows();
    expect(raw.niNumber).toBeNull();
    expect(raw.passportNumber).toBe('');
    expect(isEncrypted(raw.accountNumber)).toBe(true);
  });

  it('handles a legacy value that merely looks like ciphertext', async () => {
    // Adversarial: someone typed this into the NI field before encryption
    // existed. It must be encrypted as the literal string it is, not skipped
    // as though it were already protected.
    const lookalike = 'enc:v1:not-really-ciphertext';
    await seedLegacyRow('lookalike@backfill.test', { ni: lookalike });

    await encryptExistingFields();
    const employee = await platformPrisma.employee.findFirst({
      where: { email: 'lookalike@backfill.test' },
    });
    expect(employee?.niNumber).toBe(lookalike);
  });
});
