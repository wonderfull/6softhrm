import prisma, { platformPrisma } from '../prismaClient';
import { currentTenantId, runWithTenant } from './tenantContext';
import { sendEmail, EmailTemplates } from './emailService';

// Daily visa / contract expiry alerts. Runs once per tenant, inside that
// tenant's context, so the recipient list and the records it describes can
// only ever belong to the same company. The previous single-pass version
// emailed every tenant's admins about every other tenant's workers.

const THRESHOLDS = [30, 60, 90]; // upcoming-expiry alert windows

export type ExpiryAlert = {
  kind: 'VISA' | 'CONTRACT';
  to: string[];
  subject: string;
  html: string;
};

export type TenantExpiryResult = {
  visaNotifications: number;
  contractNotifications: number;
};

export type ExpirySweepResult = TenantExpiryResult & {
  tenantsScanned: number;
  errors: string[];
};

export function daysUntil(date: Date, now: Date) {
  return Math.ceil(
    (new Date(date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
}

// Overdue items alert every run until resolved; upcoming ones only inside a
// one-day band around each threshold so the same item is not re-sent daily.
function shouldAlert(daysRemaining: number) {
  return (
    daysRemaining <= 0 ||
    THRESHOLDS.some((t) => Math.abs(daysRemaining - t) <= 1)
  );
}

function subjectLabel(daysRemaining: number) {
  return daysRemaining <= 0
    ? `OVERDUE by ${Math.abs(daysRemaining)} days`
    : `${daysRemaining} days remaining`;
}

/**
 * Builds the alerts for the current tenant without sending anything.
 * Must run inside a tenant context.
 */
export async function collectTenantExpiryAlerts(
  now = new Date(),
): Promise<ExpiryAlert[]> {
  const recipients = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'DIRECTOR'] } },
    select: { email: true },
  });
  const recipientEmails = recipients.map((r) => r.email).filter(Boolean);

  const alerts: ExpiryAlert[] = [];

  const sponsorships = await prisma.sponsorship.findMany({
    where: { active: true, endDate: { not: null } },
    include: { employee: true },
  });
  for (const sponsorship of sponsorships) {
    if (!sponsorship.endDate) continue;
    const daysRemaining = daysUntil(sponsorship.endDate, now);
    if (!shouldAlert(daysRemaining)) continue;

    const template = EmailTemplates.visaExpiry(
      `${sponsorship.employee.firstName} ${sponsorship.employee.lastName}`,
      sponsorship.visaType,
      new Date(sponsorship.endDate).toISOString().split('T')[0],
      daysRemaining,
    );
    const to = [...recipientEmails];
    if (sponsorship.employee.email) to.push(sponsorship.employee.email);
    alerts.push({
      kind: 'VISA',
      to,
      subject: `${template.subject} — ${subjectLabel(daysRemaining)}`,
      html: template.html,
    });
  }

  const employeesWithEnd = await prisma.employee.findMany({
    where: { endDate: { not: null } },
  });
  for (const employee of employeesWithEnd) {
    if (!employee.endDate) continue;
    const daysRemaining = daysUntil(employee.endDate, now);
    if (!shouldAlert(daysRemaining)) continue;

    const template = EmailTemplates.contractExpiry(
      `${employee.firstName} ${employee.lastName}`,
      new Date(employee.endDate).toISOString().split('T')[0],
      daysRemaining,
    );
    const to = [...recipientEmails];
    if (employee.email) to.push(employee.email);
    alerts.push({
      kind: 'CONTRACT',
      to,
      subject: `${template.subject} — ${subjectLabel(daysRemaining)}`,
      html: template.html,
    });
  }

  return alerts;
}

/**
 * Collects and sends the current tenant's alerts, then writes that tenant's
 * CRON_EXPIRY_CHECK audit row (which is what the Notifications page reads
 * for "last automated run"). Must run inside a tenant context.
 */
export async function sweepTenantExpiries(
  now = new Date(),
): Promise<TenantExpiryResult> {
  const result: TenantExpiryResult = {
    visaNotifications: 0,
    contractNotifications: 0,
  };

  const alerts = await collectTenantExpiryAlerts(now);
  for (const alert of alerts) {
    for (const to of alert.to) {
      try {
        await sendEmail({ to, subject: alert.subject, html: alert.html });
        if (alert.kind === 'VISA') result.visaNotifications++;
        else result.contractNotifications++;
      } catch (err) {
        console.error(`[CRON] ${alert.kind} email failed for ${to}:`, err);
      }
    }
  }

  await platformPrisma.auditLog.create({
    data: {
      tenantId: currentTenantId(),
      userId: null,
      userEmail: 'cron@system',
      action: 'CRON_EXPIRY_CHECK',
      entity: 'System',
      entityId: null,
      details: JSON.stringify(result),
      ipAddress: null,
      userAgent: 'node-cron',
    },
  });

  return result;
}

export async function sweepAllTenantExpiries(
  now = new Date(),
): Promise<ExpirySweepResult> {
  const result: ExpirySweepResult = {
    tenantsScanned: 0,
    visaNotifications: 0,
    contractNotifications: 0,
    errors: [],
  };

  const tenants = await platformPrisma.tenant.findMany({
    where: { status: { notIn: ['SUSPENDED', 'CANCELLED'] }, deletedAt: null },
    select: { id: true },
  });

  for (const tenant of tenants) {
    result.tenantsScanned += 1;
    try {
      const tenantResult = await runWithTenant({ tenantId: tenant.id }, () =>
        sweepTenantExpiries(now),
      );
      result.visaNotifications += tenantResult.visaNotifications;
      result.contractNotifications += tenantResult.contractNotifications;
    } catch (err: any) {
      // One tenant's bad data must not stop the sweep for everyone else.
      result.errors.push(`tenant ${tenant.id}: ${err?.message || String(err)}`);
    }
  }

  return result;
}
