import cron from 'node-cron';
// Cron sweeps run outside any request. Each one iterates tenants and does its
// work inside runWithTenant(); the platform client here is only for the
// cross-tenant audit rows that record a run happened.
import { platformPrisma as prisma } from '../prismaClient';
import { detectUnauthorisedAbsence } from './absenceDetection';
import { reconcileSalaries } from './salarySweep';
import { sweepAllTenantExpiries } from './expirySweep';
import { runRetentionSweep } from './retention';

// In-memory cron status — surfaced via /api/notifications/cron-status so the
// Notifications page can show a "last run" badge. Survives until process restart;
// PM2 restarts are fine because we also write an AuditLog row on each run.
export type SweepStatus = {
  lastFinishedAt: string | null;
  lastEventsCreated: number;
  // Total failure of the run, or per-tenant errors the sweep survived —
  // either way the badge must not read healthy.
  lastError: string | null;
};

export type CronStatus = {
  lastStartedAt: string | null;
  lastFinishedAt: string | null;
  lastError: string | null;
  lastVisaNotifications: number;
  lastContractNotifications: number;
  absenceSweep: SweepStatus;
  salarySweep: SweepStatus;
  retentionSweep: SweepStatus;
};

const emptySweepStatus = (): SweepStatus => ({
  lastFinishedAt: null,
  lastEventsCreated: 0,
  lastError: null,
});

const cronStatus: CronStatus = {
  lastStartedAt: null,
  lastFinishedAt: null,
  lastError: null,
  lastVisaNotifications: 0,
  lastContractNotifications: 0,
  absenceSweep: emptySweepStatus(),
  salarySweep: emptySweepStatus(),
  retentionSweep: emptySweepStatus(),
};

export function getCronStatus(): CronStatus {
  return {
    ...cronStatus,
    absenceSweep: { ...cronStatus.absenceSweep },
    salarySweep: { ...cronStatus.salarySweep },
    retentionSweep: { ...cronStatus.retentionSweep },
  };
}

/**
 * Daily visa / contract expiry alerts, one pass per tenant (see expirySweep.ts).
 * Per-tenant errors are surfaced in cronStatus.lastError like the other sweeps.
 */
async function checkExpiringRecords() {
  console.log('[CRON] Running expiry check...');
  cronStatus.lastStartedAt = new Date().toISOString();
  cronStatus.lastError = null;

  try {
    const result = await sweepAllTenantExpiries();
    cronStatus.lastVisaNotifications = result.visaNotifications;
    cronStatus.lastContractNotifications = result.contractNotifications;
    cronStatus.lastError = result.errors.length
      ? result.errors.join('; ')
      : null;
    console.log(
      `[CRON] Expiry check complete. Tenants: ${result.tenantsScanned}, ` +
        `visa notifications: ${result.visaNotifications}, contract notifications: ${result.contractNotifications}`,
    );
  } catch (error: any) {
    cronStatus.lastError = error?.message || String(error);
    console.error('[CRON] Error checking expiries:', error);
  } finally {
    cronStatus.lastFinishedAt = new Date().toISOString();
  }
}

async function runAbsenceSweep() {
  console.log('[CRON] Running unauthorised-absence sweep...');
  try {
    const result = await detectUnauthorisedAbsence();
    await prisma.auditLog.create({
      data: {
        userId: null,
        userEmail: 'cron@system',
        action: 'CRON_ABSENCE_SWEEP',
        entity: 'System',
        entityId: null,
        details: JSON.stringify(result),
        ipAddress: null,
        userAgent: 'node-cron',
      },
    });
    console.log(
      `[CRON] Absence sweep complete. Tenants: ${result.tenantsScanned}, ` +
        `sponsorships: ${result.sponsorshipsScanned}, events raised: ${result.eventsCreated}`,
    );
    cronStatus.absenceSweep = {
      lastFinishedAt: new Date().toISOString(),
      lastEventsCreated: result.eventsCreated,
      lastError: result.errors.length ? result.errors.join('; ') : null,
    };
  } catch (error: any) {
    console.error('[CRON] Error sweeping absence:', error);
    cronStatus.absenceSweep = {
      lastFinishedAt: new Date().toISOString(),
      lastEventsCreated: 0,
      lastError: error?.message || String(error),
    };
  }
}

async function runSalarySweep() {
  console.log('[CRON] Running salary reconciliation...');
  try {
    const result = await reconcileSalaries();
    await prisma.auditLog.create({
      data: {
        userId: null,
        userEmail: 'cron@system',
        action: 'CRON_SALARY_SWEEP',
        entity: 'System',
        entityId: null,
        details: JSON.stringify(result),
        ipAddress: null,
        userAgent: 'node-cron',
      },
    });
    console.log(
      `[CRON] Salary reconciliation complete. Periods: ${result.periodsAssessed}, ` +
        `events raised: ${result.eventsCreated}, missing CoS terms: ${result.missingCosTerms}`,
    );
    cronStatus.salarySweep = {
      lastFinishedAt: new Date().toISOString(),
      lastEventsCreated: result.eventsCreated,
      lastError: result.errors.length ? result.errors.join('; ') : null,
    };
  } catch (error: any) {
    console.error('[CRON] Error reconciling salaries:', error);
    cronStatus.salarySweep = {
      lastFinishedAt: new Date().toISOString(),
      lastEventsCreated: 0,
      lastError: error?.message || String(error),
    };
  }
}

async function runRetention() {
  console.log('[CRON] Running retention sweep...');
  try {
    const result = await runRetentionSweep();
    await prisma.auditLog.create({
      data: {
        userId: null,
        userEmail: 'cron@system',
        action: 'CRON_RETENTION_SWEEP',
        entity: 'System',
        entityId: null,
        details: JSON.stringify(result),
        ipAddress: null,
        userAgent: 'node-cron',
      },
    });
    console.log(
      `[CRON] Retention sweep complete. Tenants: ${result.tenantsScanned}, ` +
        `anonymised: ${result.employeesAnonymised}, tenants purged: ${result.tenantsPurged}`,
    );
    cronStatus.retentionSweep = {
      lastFinishedAt: new Date().toISOString(),
      lastEventsCreated: result.employeesAnonymised + result.tenantsPurged,
      lastError: result.errors.length ? result.errors.join('; ') : null,
    };
  } catch (error: any) {
    console.error('[CRON] Error running retention sweep:', error);
    cronStatus.retentionSweep = {
      lastFinishedAt: new Date().toISOString(),
      lastEventsCreated: 0,
      lastError: error?.message || String(error),
    };
  }
}

export function initializeCronJobs() {
  console.log('[CRON] Initializing scheduled tasks...');
  cron.schedule('0 2 * * *', runRetention, {
    timezone: 'Europe/London',
  });
  console.log('[CRON] Scheduled nightly retention sweep at 2:00 AM UK time');
  cron.schedule('0 9 * * *', checkExpiringRecords, {
    timezone: 'Europe/London',
  });
  cron.schedule('30 9 * * *', runAbsenceSweep, {
    timezone: 'Europe/London',
  });
  console.log('[CRON] Scheduled daily expiry check at 9:00 AM UK time');
  cron.schedule('0 10 * * *', runSalarySweep, {
    timezone: 'Europe/London',
  });
  console.log('[CRON] Scheduled daily absence sweep at 9:30 AM UK time');
  console.log(
    '[CRON] Scheduled daily salary reconciliation at 10:00 AM UK time',
  );
}

// Exported for the manual "Check & Send Notifications" button.
export { checkExpiringRecords, runAbsenceSweep, runSalarySweep, runRetention };
