import fs from 'fs';
import path from 'path';
// Deploy gate: `npm run preflight`, called from scripts/deploy-vps.sh before
// `prisma migrate deploy`. Exits non-zero listing everything that is wrong, so
// a half-configured server is caught while the database and the running API
// are still untouched. The rules live in src/lib/preflight.ts.
import dotenv from 'dotenv';
import {
  checkBackupFreshness,
  checkDatabaseConnection,
  checkEnvironment,
  formatPreflightReport,
  hasFailure,
  PreflightCheck,
} from '../src/lib/preflight';

dotenv.config();

/**
 * Newest local backup, and whether this deploy is about to migrate. Migration
 * state comes from the environment because the deploy script already knows —
 * it asks prisma before calling us, so we do not pay for a second check.
 */
function readBackupState() {
  const backupsDir = path.join(__dirname, '../backups');
  let newest: Date | null = null;
  try {
    for (const entry of fs.readdirSync(backupsDir)) {
      const stat = fs.statSync(path.join(backupsDir, entry));
      if (stat.isFile() && (!newest || stat.mtime > newest)) newest = stat.mtime;
    }
  } catch {
    // No backups directory at all is itself the answer.
  }
  return {
    newest,
    pendingMigrations: process.env.PREFLIGHT_PENDING_MIGRATIONS === '1',
  };
}

async function main() {
  const checks: PreflightCheck[] = checkEnvironment();

  if (process.env.DATABASE_URL) {
    // Imported here rather than at the top: constructing the Prisma client
    // without a DATABASE_URL throws, and that case is already reported above.
    const { platformPrisma } = await import('../src/prismaClient');
    checks.push(
      // Raw on purpose — this asks whether the server answers at all, and must
      // not depend on a table that the pending migrations may not have created.
      await checkDatabaseConnection(() => platformPrisma.$queryRaw`SELECT 1`),
      checkBackupFreshness(readBackupState()),
    );
    await platformPrisma.$disconnect();
  }

  console.log(formatPreflightReport(checks));
  process.exit(hasFailure(checks) ? 1 : 0);
}

main().catch((error) => {
  console.error(
    '[preflight] the check itself failed:',
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
