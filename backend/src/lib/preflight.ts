import { getFieldEncryptionKey } from './fieldEncryption';
import { getJwtSecret } from './authConfig';

/**
 * Deploy-time environment check, run by scripts/deploy-vps.sh before
 * `prisma migrate deploy`.
 *
 * The failure it exists to prevent: a VPS missing FIELD_ENCRYPTION_KEY or
 * JWT_SECRET takes the migrations — MySQL auto-commits DDL, so they cannot be
 * rolled back — and then crashloops on boot. Schema changed, site down, and
 * the only clue is in the PM2 log. Checking first costs a second and leaves
 * production untouched when something is missing.
 *
 * Every check runs, so one deploy attempt reports everything that is wrong.
 * Validity is decided by the same functions the app boots with, never by rules
 * copied out of them. Nothing here prints a value: this output lands in the
 * deploy log.
 */
type PreflightEnv = {
  DATABASE_URL?: string;
  JWT_SECRET?: string;
  FIELD_ENCRYPTION_KEY?: string;
  FRONTEND_URL?: string;
  SMTP_HOST?: string;
  SMTP_USER?: string;
  SMTP_PASSWORD?: string;
  STORAGE_DRIVER?: string;
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET?: string;
};

export type PreflightStatus = 'ok' | 'warn' | 'fail';

export type PreflightCheck = {
  name: string;
  status: PreflightStatus;
  /** Reads as a sentence after the name. Never contains a configured value. */
  detail: string;
};

// A message from a validator opens with the variable it is about, which the
// report already prints in its own column.
function reason(name: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.startsWith(`${name} `)
    ? message.slice(name.length + 1)
    : message;
}

// Connection errors quote the URL they failed on, and ours carries a password.
function redactCredentials(text: string): string {
  return text.replace(/\/\/[^/@\s]*@/g, '//***@');
}

function checkDatabaseUrl(env: PreflightEnv): PreflightCheck {
  if (!env.DATABASE_URL?.trim()) {
    return {
      name: 'DATABASE_URL',
      status: 'fail',
      detail:
        'is not set — the app has no database to talk to. Set it in backend/.env.',
    };
  }
  return { name: 'DATABASE_URL', status: 'ok', detail: 'set' };
}

function checkJwtSecret(env: PreflightEnv): PreflightCheck {
  try {
    // An absent variable must stay absent: passing `undefined` would trigger
    // the validator's default parameter and read process.env instead.
    const secret = getJwtSecret(env.JWT_SECRET ?? '');
    if (secret.length < 32) {
      return {
        name: 'JWT_SECRET',
        status: 'warn',
        detail:
          'is shorter than 32 characters — regenerate with `openssl rand -base64 32`',
      };
    }
    return { name: 'JWT_SECRET', status: 'ok', detail: 'set' };
  } catch (error) {
    return {
      name: 'JWT_SECRET',
      status: 'fail',
      detail: `${reason('JWT_SECRET', error)} — set a real value in backend/.env (\`openssl rand -base64 32\`); the placeholder \`change_me\` is refused. Logins fail without it.`,
    };
  }
}

function checkFieldEncryptionKey(env: PreflightEnv): PreflightCheck {
  try {
    const key = getFieldEncryptionKey(env.FIELD_ENCRYPTION_KEY ?? '');
    return {
      name: 'FIELD_ENCRYPTION_KEY',
      status: 'ok',
      detail: `set (${key.length * 2} hex chars)`,
    };
  } catch (error) {
    return {
      name: 'FIELD_ENCRYPTION_KEY',
      status: 'fail',
      detail: `${reason('FIELD_ENCRYPTION_KEY', error)} The API refuses to boot without it.`,
    };
  }
}

function checkStorage(env: PreflightEnv): PreflightCheck {
  const driver = env.STORAGE_DRIVER?.trim() || 'local';
  if (driver === 'local') {
    return {
      name: 'STORAGE_DRIVER',
      status: 'ok',
      detail: 'local (documents stored under backend/uploads)',
    };
  }
  if (driver !== 'r2') {
    // storage.ts falls back to the local driver for anything it does not
    // recognise, so a typo silently writes documents to this box's disk.
    return {
      name: 'STORAGE_DRIVER',
      status: 'warn',
      detail: `is "${driver}", which is neither local nor r2 — documents will be written to this server's disk`,
    };
  }
  const missing = (
    [
      'R2_ACCOUNT_ID',
      'R2_ACCESS_KEY_ID',
      'R2_SECRET_ACCESS_KEY',
      'R2_BUCKET',
    ] as const
  ).filter((key) => !env[key]?.trim());
  if (missing.length > 0) {
    return {
      name: 'STORAGE_DRIVER',
      status: 'fail',
      detail: `is r2 but ${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} not set — every document upload and download will throw`,
    };
  }
  return {
    name: 'STORAGE_DRIVER',
    status: 'ok',
    detail: 'r2 (bucket configured)',
  };
}

function checkEmail(env: PreflightEnv): PreflightCheck {
  const missing = (['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD'] as const).filter(
    (key) => !env[key]?.trim(),
  );
  if (missing.length > 0) {
    return {
      name: 'SMTP',
      status: 'warn',
      detail: `is not configured (${missing.join(', ')}) — email is silently dropped, so password resets and expiry alerts never arrive`,
    };
  }
  return { name: 'SMTP', status: 'ok', detail: 'configured' };
}

function checkFrontendUrl(env: PreflightEnv): PreflightCheck {
  if (!env.FRONTEND_URL?.trim()) {
    return {
      name: 'FRONTEND_URL',
      status: 'warn',
      detail:
        'is not set — password-reset and tenant-setup links fall back to http://localhost:5174',
    };
  }
  return { name: 'FRONTEND_URL', status: 'ok', detail: 'set' };
}

export function checkEnvironment(
  env: PreflightEnv = process.env as PreflightEnv,
): PreflightCheck[] {
  return [
    checkDatabaseUrl(env),
    checkJwtSecret(env),
    checkFieldEncryptionKey(env),
    checkStorage(env),
    checkEmail(env),
    checkFrontendUrl(env),
  ];
}

/**
 * A wrong DATABASE_URL is the other way this deploy strands itself, and only a
 * real round-trip catches it. The query is injected so the caller owns the
 * Prisma client — and so this stays testable without a database.
 */
export async function checkDatabaseConnection(
  ping: () => Promise<unknown>,
): Promise<PreflightCheck> {
  try {
    await ping();
    return { name: 'database', status: 'ok', detail: 'reachable' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Prisma opens with "Invalid `prisma.$queryRaw()` invocation:" and puts the
    // reason ("Can't reach database server at …") a few lines down.
    const reported =
      message
        .split('\n')
        .map((line) => line.trim())
        .find((line) => line && !/^Invalid `.*` invocation/.test(line)) ??
      message.trim();
    return {
      name: 'database',
      status: 'fail',
      detail: `is unreachable — ${redactCredentials(reported)}`,
    };
  }
}

export function hasFailure(checks: PreflightCheck[]): boolean {
  return checks.some((check) => check.status === 'fail');
}

export function formatPreflightReport(checks: PreflightCheck[]): string {
  const width = Math.max(...checks.map((check) => check.name.length));
  const label: Record<PreflightStatus, string> = {
    ok: 'ok  ',
    warn: 'warn',
    fail: 'FAIL',
  };

  const lines = checks.map(
    (check) =>
      `  ${label[check.status]}  ${check.name.padEnd(width)}  ${check.detail}`,
  );

  const failures = checks.filter((check) => check.status === 'fail').length;
  const warnings = checks.filter((check) => check.status === 'warn').length;

  lines.unshift('[preflight] backend environment', '');
  lines.push('');
  if (failures > 0) {
    lines.push(
      `[preflight] ${failures} problem${failures === 1 ? '' : 's'} must be fixed before deploying — nothing has been migrated or restarted`,
    );
  } else {
    lines.push(
      `[preflight] environment is complete${warnings > 0 ? ` (${warnings} warning${warnings === 1 ? '' : 's'})` : ''} — safe to deploy`,
    );
  }
  return lines.join('\n');
}

/** How stale a backup may be before a migrating deploy is refused. */
export const BACKUP_MAX_AGE_HOURS = 26;

export type BackupState = {
  /** When the newest backup was written, or null if there is none. */
  newest: Date | null;
  /** Whether this deploy is about to apply a migration. */
  pendingMigrations: boolean;
};

/**
 * The release plan says to confirm the nightly backup is fresh before merging
 * a migration. That was a human step, done from memory, that nobody could
 * audit afterwards — so the deploy checks it instead.
 *
 * Only a migrating deploy is blocked. A stale backup is worth knowing about
 * either way, but it is not a reason to refuse a code-only release: that would
 * teach people to skip the check to get anything out at all.
 */
export function checkBackupFreshness(
  state: BackupState,
  now = new Date(),
): PreflightCheck {
  const failWhenMigrating: PreflightStatus = state.pendingMigrations
    ? 'fail'
    : 'warn';

  if (!state.newest) {
    return {
      name: 'backup',
      status: failWhenMigrating,
      detail: state.pendingMigrations
        ? 'no database backup was found, and this deploy applies migrations — take one first (npm run backup)'
        : 'no database backup was found — the nightly job may not be running',
    };
  }

  const ageHours = Math.floor(
    (now.getTime() - state.newest.getTime()) / 3600_000,
  );
  if (ageHours <= BACKUP_MAX_AGE_HOURS) {
    return {
      name: 'backup',
      status: 'ok',
      detail: `newest is ${ageHours} hours old`,
    };
  }

  return {
    name: 'backup',
    status: failWhenMigrating,
    detail: state.pendingMigrations
      ? `newest backup is ${ageHours} hours old and this deploy applies migrations — take a fresh one first (npm run backup)`
      : `newest backup is ${ageHours} hours old — the nightly job may not be running`,
  };
}
