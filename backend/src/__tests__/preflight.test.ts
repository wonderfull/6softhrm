import { describe, expect, it } from '@jest/globals';
import {
  checkDatabaseConnection,
  checkEnvironment,
  formatPreflightReport,
  hasFailure,
  checkBackupFreshness,
} from '../lib/preflight';

// The deploy script runs this before `prisma migrate deploy`. If it lets a
// half-configured VPS through, the migrations land and the API crashloops on
// the missing key — schema changed, site down. So: every problem in one pass,
// and never a secret in the output, because this goes to the deploy log.

const COMPLETE = {
  DATABASE_URL: 'mysql://hrm:s3cr3t@localhost:3306/onsidehr',
  JWT_SECRET: 'CqQ7m2Yb0dJv8pS1tWx4zA6nR3fK5hL9uE0iO2gT4vY=',
  FIELD_ENCRYPTION_KEY: 'a'.repeat(64),
  FRONTEND_URL: 'https://app.onsidehr.co.uk',
  SMTP_HOST: 'smtp.example.com',
  SMTP_USER: 'mailer@example.com',
  SMTP_PASSWORD: 'not-a-real-password',
  STORAGE_DRIVER: 'local',
};

const failedNames = (env: Parameters<typeof checkEnvironment>[0]) =>
  checkEnvironment(env)
    .filter((check) => check.status === 'fail')
    .map((check) => check.name);

describe('checkEnvironment', () => {
  it('reports every missing required variable in one pass', () => {
    const names = failedNames({});
    expect(names).toEqual(
      expect.arrayContaining([
        'DATABASE_URL',
        'JWT_SECRET',
        'FIELD_ENCRYPTION_KEY',
      ]),
    );
    expect(hasFailure(checkEnvironment({}))).toBe(true);
  });

  it('rejects a FIELD_ENCRYPTION_KEY of the wrong length', () => {
    expect(
      failedNames({ ...COMPLETE, FIELD_ENCRYPTION_KEY: 'a'.repeat(32) }),
    ).toEqual(['FIELD_ENCRYPTION_KEY']);
  });

  it('rejects a FIELD_ENCRYPTION_KEY that is not hex', () => {
    expect(
      failedNames({ ...COMPLETE, FIELD_ENCRYPTION_KEY: 'z'.repeat(64) }),
    ).toEqual(['FIELD_ENCRYPTION_KEY']);
  });

  it('rejects the placeholder JWT_SECRET', () => {
    expect(failedNames({ ...COMPLETE, JWT_SECRET: 'change_me' })).toEqual([
      'JWT_SECRET',
    ]);
  });

  it('passes a complete environment', () => {
    const checks = checkEnvironment(COMPLETE);
    expect(checks.filter((check) => check.status !== 'ok')).toEqual([]);
    expect(hasFailure(checks)).toBe(false);
  });

  it('warns about unconfigured email without blocking the deploy', () => {
    const checks = checkEnvironment({
      ...COMPLETE,
      SMTP_HOST: undefined,
      SMTP_USER: undefined,
      SMTP_PASSWORD: undefined,
    });
    const smtp = checks.find((check) => check.name === 'SMTP');
    expect(smtp?.status).toBe('warn');
    expect(smtp?.detail).toMatch(/email/i);
    expect(hasFailure(checks)).toBe(false);
  });

  it('fails an r2 storage driver with no bucket credentials', () => {
    expect(failedNames({ ...COMPLETE, STORAGE_DRIVER: 'r2' })).toEqual([
      'STORAGE_DRIVER',
    ]);
    expect(
      failedNames({
        ...COMPLETE,
        STORAGE_DRIVER: 'r2',
        R2_ACCOUNT_ID: 'acct',
        R2_ACCESS_KEY_ID: 'key',
        R2_SECRET_ACCESS_KEY: 'secret',
        R2_BUCKET: 'onsidehr-docs',
      }),
    ).toEqual([]);
  });
});

describe('checkDatabaseConnection', () => {
  it('passes when the query round-trips', async () => {
    const check = await checkDatabaseConnection(async () => [{ 1: 1 }]);
    expect(check.status).toBe('ok');
  });

  it('reports the reason Prisma buries under its invocation banner', async () => {
    const check = await checkDatabaseConnection(async () => {
      throw new Error(
        '\nInvalid `prisma.$queryRaw()` invocation:\n\n\n' +
          "Can't reach database server at `127.0.0.1:3399`\n\n" +
          'Please make sure your database server is running at `127.0.0.1:3399`.',
      );
    });
    expect(check.status).toBe('fail');
    expect(check.detail).toContain("Can't reach database server");
    expect(check.detail).not.toContain('invocation');
  });

  it('strips credentials out of a quoted connection string', async () => {
    const check = await checkDatabaseConnection(async () => {
      throw new Error('Cannot open mysql://hrm:s3cr3t@localhost:3306/onsidehr');
    });
    expect(check.detail).not.toContain('s3cr3t');
    expect(check.detail).toContain('//***@');
  });
});

describe('formatPreflightReport', () => {
  it('never prints a secret it was given', () => {
    const report = formatPreflightReport(checkEnvironment(COMPLETE));
    expect(report).toContain('FIELD_ENCRYPTION_KEY');
    expect(report).toContain('64 hex chars');
    expect(report).not.toContain(COMPLETE.FIELD_ENCRYPTION_KEY);
    expect(report).not.toContain(COMPLETE.JWT_SECRET);
    expect(report).not.toContain(COMPLETE.SMTP_PASSWORD);
    expect(report).not.toContain('s3cr3t');
  });

  it('lists what to fix when something is wrong', () => {
    const report = formatPreflightReport(
      checkEnvironment({ ...COMPLETE, FIELD_ENCRYPTION_KEY: undefined }),
    );
    expect(report).toContain('FAIL');
    expect(report).toContain('openssl rand -hex 32');
  });
});

describe('checkBackupFreshness', () => {
  const now = new Date('2026-09-05T09:00:00Z');
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000);

  // The release plan says: confirm the nightly backup is fresh before merging
  // any migration. That was a human step nobody can audit, so the deploy
  // enforces it — but only when a migration is actually about to run, because
  // a stale backup is not a reason to block a code-only deploy.
  it('passes when a backup is newer than the limit', () => {
    const check = checkBackupFreshness(
      { newest: hoursAgo(3), pendingMigrations: true },
      now,
    );
    expect(check.status).toBe('ok');
  });

  it('fails a migrating deploy when the newest backup is stale', () => {
    const check = checkBackupFreshness(
      { newest: hoursAgo(50), pendingMigrations: true },
      now,
    );
    expect(check.status).toBe('fail');
    expect(check.detail).toMatch(/50 hours/);
  });

  it('fails a migrating deploy when there is no backup at all', () => {
    const check = checkBackupFreshness(
      { newest: null, pendingMigrations: true },
      now,
    );
    expect(check.status).toBe('fail');
  });

  it('only warns when nothing is being migrated', () => {
    expect(
      checkBackupFreshness({ newest: hoursAgo(50), pendingMigrations: false }, now)
        .status,
    ).toBe('warn');
    expect(
      checkBackupFreshness({ newest: null, pendingMigrations: false }, now).status,
    ).toBe('warn');
  });

  it('never reports a path or a filename', () => {
    const check = checkBackupFreshness(
      { newest: hoursAgo(50), pendingMigrations: true },
      now,
    );
    expect(check.detail).not.toMatch(/\//);
  });
});
