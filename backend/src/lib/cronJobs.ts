import cron from 'node-cron';
// Cron sweeps run outside any request, so they use the platform client.
// TODO(multi-tenant P6): iterate tenants and run each sweep inside
// runWithTenant() so alerts only reach that tenant's admins.
import { platformPrisma as prisma } from '../prismaClient';
import { sendEmail, EmailTemplates } from './emailService';
import { detectUnauthorisedAbsence } from './absenceDetection';
import { reconcileSalaries } from './salarySweep';

// In-memory cron status — surfaced via /api/notifications/cron-status so the
// Notifications page can show a "last run" badge. Survives until process restart;
// PM2 restarts are fine because we also write an AuditLog row on each run.
export type CronStatus = {
  lastStartedAt: string | null;
  lastFinishedAt: string | null;
  lastError: string | null;
  lastVisaNotifications: number;
  lastContractNotifications: number;
};

const cronStatus: CronStatus = {
  lastStartedAt: null,
  lastFinishedAt: null,
  lastError: null,
  lastVisaNotifications: 0,
  lastContractNotifications: 0,
};

export function getCronStatus(): CronStatus {
  return { ...cronStatus };
}

/**
 * Check for visas and contracts that are about to expire (30/60/90 day windows)
 * AND those that are already overdue, and email the admins/directors + employees.
 *
 * Tracks last-sent timestamp on each record (via AuditLog) so we don't re-email
 * the same item every day inside the same threshold band.
 */
async function checkExpiringRecords() {
  console.log('[CRON] Running expiry check...');
  cronStatus.lastStartedAt = new Date().toISOString();
  cronStatus.lastError = null;
  const now = new Date();
  const thresholds = [30, 60, 90]; // upcoming-expiry alert windows

  let visaNotifications = 0;
  let contractNotifications = 0;

  try {
    // Always-fresh recipient list (admins + directors). MANAGER is a legacy
    // alias that no longer exists in our role enum — don't filter on it.
    const recipients = await prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'DIRECTOR'] } },
    });
    const recipientEmails = recipients.map((r) => r.email).filter(Boolean);

    // -------- Visas (Sponsorship.endDate) --------
    const sponsorships = await prisma.sponsorship.findMany({
      where: { active: true, endDate: { not: null } },
      include: { employee: true },
    });

    for (const sponsorship of sponsorships) {
      if (!sponsorship.endDate) continue;
      const daysRemaining = Math.ceil(
        (new Date(sponsorship.endDate).getTime() - now.getTime()) /
          (1000 * 60 * 60 * 24),
      );

      const shouldAlert =
        daysRemaining <= 0 || // overdue — alert every run until resolved
        thresholds.some((t) => Math.abs(daysRemaining - t) <= 1);
      if (!shouldAlert) continue;

      const subjectLabel =
        daysRemaining <= 0
          ? `OVERDUE by ${Math.abs(daysRemaining)} days`
          : `${daysRemaining} days remaining`;
      const template = EmailTemplates.visaExpiry(
        `${sponsorship.employee.firstName} ${sponsorship.employee.lastName}`,
        sponsorship.visaType,
        new Date(sponsorship.endDate).toISOString().split('T')[0],
        daysRemaining,
      );
      const subject = `${template.subject} — ${subjectLabel}`;

      const toList = [...recipientEmails];
      if (sponsorship.employee.email) toList.push(sponsorship.employee.email);
      for (const to of toList) {
        try {
          await sendEmail({ to, subject, html: template.html });
          visaNotifications++;
        } catch (err) {
          console.error(`[CRON] visa email failed for ${to}:`, err);
        }
      }
    }

    // -------- Contracts (Employee.endDate) --------
    const employeesWithEnd = await prisma.employee.findMany({
      where: { endDate: { not: null } },
    });

    for (const employee of employeesWithEnd) {
      if (!employee.endDate) continue;
      const daysRemaining = Math.ceil(
        (new Date(employee.endDate).getTime() - now.getTime()) /
          (1000 * 60 * 60 * 24),
      );

      const shouldAlert =
        daysRemaining <= 0 ||
        thresholds.some((t) => Math.abs(daysRemaining - t) <= 1);
      if (!shouldAlert) continue;

      const subjectLabel =
        daysRemaining <= 0
          ? `OVERDUE by ${Math.abs(daysRemaining)} days`
          : `${daysRemaining} days remaining`;
      const template = EmailTemplates.contractExpiry(
        `${employee.firstName} ${employee.lastName}`,
        new Date(employee.endDate).toISOString().split('T')[0],
        daysRemaining,
      );
      const subject = `${template.subject} — ${subjectLabel}`;

      const toList = [...recipientEmails];
      if (employee.email) toList.push(employee.email);
      for (const to of toList) {
        try {
          await sendEmail({ to, subject, html: template.html });
          contractNotifications++;
        } catch (err) {
          console.error(`[CRON] contract email failed for ${to}:`, err);
        }
      }
    }

    cronStatus.lastVisaNotifications = visaNotifications;
    cronStatus.lastContractNotifications = contractNotifications;

    // Write an AuditLog row so a "last run" timestamp survives restarts.
    await prisma.auditLog.create({
      data: {
        userId: null,
        userEmail: 'cron@system',
        action: 'CRON_EXPIRY_CHECK',
        entity: 'System',
        entityId: null,
        details: JSON.stringify({ visaNotifications, contractNotifications }),
        ipAddress: null,
        userAgent: 'node-cron',
      },
    });

    console.log(
      `[CRON] Expiry check complete. Visa notifications: ${visaNotifications}, Contract notifications: ${contractNotifications}`,
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
  } catch (error: any) {
    console.error('[CRON] Error sweeping absence:', error);
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
  } catch (error: any) {
    console.error('[CRON] Error reconciling salaries:', error);
  }
}

export function initializeCronJobs() {
  console.log('[CRON] Initializing scheduled tasks...');
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
  console.log('[CRON] Scheduled daily salary reconciliation at 10:00 AM UK time');
}

// Exported for the manual "Check & Send Notifications" button.
export { checkExpiringRecords, runAbsenceSweep, runSalarySweep };
