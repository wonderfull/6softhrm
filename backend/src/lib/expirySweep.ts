import prisma, { platformPrisma } from '../prismaClient';
import { currentTenantId, runWithTenant } from './tenantContext';
import { sendEmail, EmailTemplates } from './emailService';
import { notifyRoles } from './notify';

// Daily expiry alerts. Runs once per tenant, inside that tenant's context, so
// the recipient list and the records it describes can only ever belong to the
// same company. The previous single-pass version emailed every tenant's
// admins about every other tenant's workers.

const THRESHOLDS = [30, 60, 90]; // upcoming-expiry alert windows

export type ExpiryKind =
  | 'VISA'
  | 'CONTRACT'
  | 'VISA_DOCUMENT'
  | 'PASSPORT'
  | 'DBS_RECHECK'
  | 'RTW_RECHECK'
  | 'LICENCE'
  | 'ACTION_PLAN'
  | 'COS_START_BY';

// Everything with a date the company must act before, in one shape so the
// sweep, the Notifications page and the inbox all read the same list.
export type ExpiringItem = {
  kind: ExpiryKind;
  label: string;
  /** Row the date lives on (sponsorship, employee, check or licence id). */
  id: number;
  employeeId?: number;
  employeeName?: string;
  employeeEmail?: string | null;
  jobTitle?: string | null;
  detail?: string | null;
  expiryDate: Date;
  daysRemaining: number;
  link: string;
};

export type ExpiryAlert = {
  kind: ExpiryKind;
  to: string[];
  subject: string;
  html: string;
  item: ExpiringItem;
};

export type TenantExpiryResult = {
  visaNotifications: number;
  contractNotifications: number;
  otherNotifications: number;
  inAppNotifications: number;
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

const isoDate = (d: Date) => new Date(d).toISOString().split('T')[0];

const KIND_LABEL: Record<ExpiryKind, string> = {
  VISA: 'Visa expiry',
  CONTRACT: 'Contract expiry',
  VISA_DOCUMENT: 'Visa document expiry',
  PASSPORT: 'Passport expiry',
  DBS_RECHECK: 'DBS recheck due',
  RTW_RECHECK: 'Right-to-work recheck due',
  LICENCE: 'Sponsor licence expiry',
  ACTION_PLAN: 'Sponsor licence action plan deadline',
  COS_START_BY: 'CoS start-by date',
};

const KIND_ACTION: Record<ExpiryKind, string> = {
  VISA: 'Review visa status and renewal before expiry.',
  CONTRACT: 'Review and renew employment contract before expiry.',
  VISA_DOCUMENT: 'Obtain the renewed visa and record a follow-up right-to-work check.',
  PASSPORT: 'Ask the worker for their renewed passport and update the record.',
  DBS_RECHECK: 'Apply for a new DBS check and record the certificate.',
  RTW_RECHECK:
    'Carry out a follow-up right-to-work check before the current permission ends.',
  LICENCE: 'Apply to renew the sponsor licence before it expires.',
  ACTION_PLAN:
    'Complete every action on the Home Office action plan before the deadline.',
  COS_START_BY:
    'Confirm the worker has started, or report the delayed start via SMS.',
};

/**
 * Every dated obligation for the current tenant that falls on or before
 * `now + horizonDays`, overdue items included. Must run inside a tenant
 * context.
 */
export async function collectTenantExpiringItems(
  now = new Date(),
  horizonDays = 90,
): Promise<ExpiringItem[]> {
  const horizon = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000);
  const items: ExpiringItem[] = [];
  const employeeName = (e: { firstName: string; lastName: string }) =>
    `${e.firstName} ${e.lastName}`;
  const push = (
    kind: ExpiryKind,
    id: number,
    expiryDate: Date,
    link: string,
    rest: Partial<ExpiringItem> = {},
  ) => {
    items.push({
      kind,
      label: KIND_LABEL[kind],
      id,
      expiryDate,
      daysRemaining: daysUntil(expiryDate, now),
      link,
      ...rest,
    });
  };

  const sponsorships = await prisma.sponsorship.findMany({
    where: { active: true, employee: { anonymisedAt: null } },
    include: { employee: true },
  });
  const sponsoredEmployeeIds = new Set(sponsorships.map((s) => s.employeeId));
  for (const s of sponsorships) {
    const who = {
      employeeId: s.employee.id,
      employeeName: employeeName(s.employee),
      employeeEmail: s.employee.email,
      jobTitle: s.employee.jobTitle,
    };
    if (s.endDate && s.endDate <= horizon) {
      push('VISA', s.id, s.endDate, '/sponsorships', {
        ...who,
        detail: s.visaType,
      });
    }
    // A CoS lapses if the worker has not started by this date; once a start
    // date is recorded there is nothing left to chase.
    if (s.cosStartBy && !s.employee.startDate && s.cosStartBy <= horizon) {
      push('COS_START_BY', s.id, s.cosStartBy, '/sponsorships', {
        ...who,
        detail: s.visaType,
      });
    }
  }

  const employees = await prisma.employee.findMany({
    where: {
      anonymisedAt: null,
      OR: [
        { endDate: { not: null, lte: horizon } },
        { visaExpiryDate: { not: null, lte: horizon } },
        { passportExpiryDate: { not: null, lte: horizon } },
        { dbsRecheckDate: { not: null, lte: horizon } },
      ],
    },
  });
  for (const e of employees) {
    const who = {
      employeeId: e.id,
      employeeName: employeeName(e),
      employeeEmail: e.email,
      jobTitle: e.jobTitle,
    };
    const link = `/employees?id=${e.id}`;
    if (e.endDate && e.endDate <= horizon)
      push('CONTRACT', e.id, e.endDate, link, who);
    // Sponsored workers are covered by the sponsorship's end date above.
    if (
      e.visaExpiryDate &&
      e.visaExpiryDate <= horizon &&
      !sponsoredEmployeeIds.has(e.id)
    )
      push('VISA_DOCUMENT', e.id, e.visaExpiryDate, link, {
        ...who,
        detail: e.visaNumber,
      });
    if (e.passportExpiryDate && e.passportExpiryDate <= horizon)
      push('PASSPORT', e.id, e.passportExpiryDate, link, {
        ...who,
        detail: e.passportCountryOfIssue,
      });
    if (e.dbsRecheckDate && e.dbsRecheckDate <= horizon)
      push('DBS_RECHECK', e.id, e.dbsRecheckDate, link, {
        ...who,
        detail: e.dbsLevel,
      });
  }

  // Only the newest check per worker counts: a later permanent check clears
  // an earlier time-limited one.
  const checks = await prisma.rightToWorkCheck.findMany({
    where: { employee: { anonymisedAt: null } },
    orderBy: [{ checkDate: 'desc' }, { id: 'desc' }],
    include: { employee: true },
  });
  const seen = new Set<number>();
  for (const c of checks) {
    if (seen.has(c.employeeId)) continue;
    seen.add(c.employeeId);
    if (c.recheckDue && c.recheckDue <= horizon) {
      push('RTW_RECHECK', c.id, c.recheckDue, `/employees?id=${c.employeeId}`, {
        employeeId: c.employeeId,
        employeeName: employeeName(c.employee),
        employeeEmail: c.employee.email,
        jobTitle: c.employee.jobTitle,
        detail: c.method,
      });
    }
  }

  const licence = await prisma.sponsorLicence.findFirst({});
  if (licence) {
    if (licence.expiryDate && licence.expiryDate <= horizon)
      push('LICENCE', licence.id, licence.expiryDate, '/settings', {
        detail: licence.licenceNumber,
      });
    if (licence.actionPlanDueAt && licence.actionPlanDueAt <= horizon)
      push('ACTION_PLAN', licence.id, licence.actionPlanDueAt, '/settings', {
        detail: licence.rating,
      });
  }

  return items.sort((a, b) => a.daysRemaining - b.daysRemaining);
}

// Personal documents go to the worker as well as HR; company-level dates
// (licence, action plan, CoS) stay with HR.
const EMPLOYEE_COPY: ReadonlySet<ExpiryKind> = new Set([
  'VISA',
  'CONTRACT',
  'VISA_DOCUMENT',
  'PASSPORT',
  'RTW_RECHECK',
]);

function buildEmail(item: ExpiringItem) {
  const date = isoDate(item.expiryDate);
  if (item.kind === 'VISA')
    return EmailTemplates.visaExpiry(
      item.employeeName ?? '',
      item.detail ?? '',
      date,
      item.daysRemaining,
    );
  if (item.kind === 'CONTRACT')
    return EmailTemplates.contractExpiry(
      item.employeeName ?? '',
      date,
      item.daysRemaining,
    );
  return EmailTemplates.complianceReminder(
    item.label,
    item.employeeName ?? item.detail ?? 'Sponsor licence',
    date,
    item.daysRemaining,
    KIND_ACTION[item.kind],
  );
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

  const items = await collectTenantExpiringItems(now, Math.max(...THRESHOLDS) + 1);
  const alerts: ExpiryAlert[] = [];
  for (const item of items) {
    if (!shouldAlert(item.daysRemaining)) continue;
    const template = buildEmail(item);
    const to = [...recipientEmails];
    if (EMPLOYEE_COPY.has(item.kind) && item.employeeEmail)
      to.push(item.employeeEmail);
    alerts.push({
      kind: item.kind,
      to,
      subject: `${template.subject} — ${subjectLabel(item.daysRemaining)}`,
      html: template.html,
      item,
    });
  }
  return alerts;
}

/**
 * Collects and sends the current tenant's alerts, mirrors each into the
 * in-app inbox of that tenant's admins, then writes the tenant's
 * CRON_EXPIRY_CHECK audit row (which is what the Notifications page reads
 * for "last automated run"). Must run inside a tenant context.
 */
export async function sweepTenantExpiries(
  now = new Date(),
): Promise<TenantExpiryResult> {
  const result: TenantExpiryResult = {
    visaNotifications: 0,
    contractNotifications: 0,
    otherNotifications: 0,
    inAppNotifications: 0,
  };

  const alerts = await collectTenantExpiryAlerts(now);
  for (const alert of alerts) {
    for (const to of alert.to) {
      try {
        await sendEmail({ to, subject: alert.subject, html: alert.html });
        if (alert.kind === 'VISA') result.visaNotifications++;
        else if (alert.kind === 'CONTRACT') result.contractNotifications++;
        else result.otherNotifications++;
      } catch (err) {
        console.error(`[CRON] ${alert.kind} email failed for ${to}:`, err);
      }
    }
    try {
      const { item } = alert;
      result.inAppNotifications += await notifyRoles(['ADMIN', 'DIRECTOR'], {
        type: 'EXPIRY',
        title: `${item.label}: ${item.employeeName ?? item.detail ?? 'sponsor licence'}`,
        body: `${isoDate(item.expiryDate)} — ${subjectLabel(item.daysRemaining)}`,
        link: item.link,
        skipIfUnreadDuplicate: true,
      });
    } catch (err) {
      console.error(`[CRON] ${alert.kind} in-app notification failed:`, err);
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
    otherNotifications: 0,
    inAppNotifications: 0,
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
      result.otherNotifications += tenantResult.otherNotifications;
      result.inAppNotifications += tenantResult.inAppNotifications;
    } catch (err: any) {
      // One tenant's bad data must not stop the sweep for everyone else.
      result.errors.push(`tenant ${tenant.id}: ${err?.message || String(err)}`);
    }
  }

  return result;
}
