// One-off (but re-runnable) backfill: encrypts Employee rows whose sensitive
// columns still hold plaintext from before column encryption landed.
//   npm run encrypt:fields -- --dry-run
//   npm run encrypt:fields
// Idempotent: a value already stored as ciphertext is left untouched, so the
// script can be re-run after a partial run, a restore, or a later import.
import { platformPrisma } from '../src/prismaClient';
import {
  ENCRYPTED_FIELDS,
  assertFieldEncryptionKey,
  isGenuineCiphertext,
} from '../src/lib/fieldEncryption';

type RawEmployeeRow = { id: number } & Record<string, string | null>;

export type BackfillStats = {
  rows: number;
  rowsEncrypted: number;
  fieldsEncrypted: number;
  fieldsAlreadyEncrypted: number;
};

export async function encryptExistingFields(
  options: { dryRun?: boolean } = {},
): Promise<BackfillStats> {
  assertFieldEncryptionKey();

  // Raw read on purpose: every other path through the client decrypts, and the
  // point here is to see what is actually stored in the column.
  const rows = await platformPrisma.$queryRaw<RawEmployeeRow[]>`
    SELECT id, niNumber, passportNumber, accountNumber, sortCode FROM Employee
  `;

  const stats: BackfillStats = {
    rows: rows.length,
    rowsEncrypted: 0,
    fieldsEncrypted: 0,
    fieldsAlreadyEncrypted: 0,
  };

  for (const row of rows) {
    const plaintext: Record<string, string> = {};
    for (const field of ENCRYPTED_FIELDS) {
      const stored = row[field];
      if (stored === null || stored === undefined || stored === '') continue;
      // Deliberately not the bare prefix test: a legacy value that merely
      // starts with the prefix must be encrypted like any other plaintext,
      // or it stays unprotected and throws on every subsequent read.
      if (isGenuineCiphertext(stored)) {
        stats.fieldsAlreadyEncrypted++;
        continue;
      }
      plaintext[field] = stored;
    }

    const fields = Object.keys(plaintext);
    if (fields.length === 0) continue;

    stats.rowsEncrypted++;
    stats.fieldsEncrypted += fields.length;
    if (options.dryRun) continue;

    // updateMany runs through the client extension, which does the encrypting —
    // there is no second copy of the cipher logic here to drift.
    await platformPrisma.employee.updateMany({
      where: { id: row.id },
      data: plaintext,
    });
  }

  return stats;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const stats = await encryptExistingFields({ dryRun });
  console.log(
    `[ENCRYPT-FIELDS]${dryRun ? ' (dry run)' : ''} employees=${stats.rows} ` +
      `rows_needing_encryption=${stats.rowsEncrypted} ` +
      `fields_encrypted=${stats.fieldsEncrypted} ` +
      `fields_already_encrypted=${stats.fieldsAlreadyEncrypted}`,
  );
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error(
        '[ENCRYPT-FIELDS] failed:',
        e instanceof Error ? e.message : e,
      );
      process.exitCode = 1;
    })
    .finally(() => platformPrisma.$disconnect());
}
