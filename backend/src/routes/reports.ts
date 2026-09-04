import { Router } from 'express';
import * as XLSX from 'xlsx';
import prisma, { platformPrisma } from '../prismaClient';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/roles';
import { auditLog } from '../middleware/audit';
import { currentTenantId } from '../lib/tenantContext';
import { computeAuditReadiness } from '../lib/auditReadiness';
import { collectTenantExpiringItems } from '../lib/expirySweep';
import { loadLeaveSettings } from '../lib/tenantSettings';
import { leaveYearBounds, requestDays } from '../lib/leave';
import { addUtcDays, toIsoDate } from '../lib/workingDays';

// Everything a director asks for on a Monday morning, in one call. The
// dashboard used to fan out to seven endpoints and add up the rows in the
// browser, which meant every screen disagreed slightly with every other.

const router = Router();

const EXPIRY_BUCKETS = [30, 60, 90];

/** Is the compliance feature on for this tenant? A missing map means yes. */
async function complianceEnabled() {
  const tenant = await platformPrisma.tenant.findUnique({
    where: { id: currentTenantId() },
    select: { features: true },
  });
  const features = (tenant?.features ?? null) as Record<string, boolean> | null;
  return !features || features.compliance !== false;
}

function groupCount<T>(rows: T[], key: (row: T) => string | null | undefined) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const name = key(row) || 'Unassigned';
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

async function headcountSummary(now: Date) {
  const thirtyDaysAgo = addUtcDays(now, -30);
  const active = await prisma.employee.findMany({
    where: { endDate: null, anonymisedAt: null },
    select: { id: true, department: true, employeeType: true },
  });

  const [starters, leavers] = await Promise.all([
    prisma.employee.count({
      where: { startDate: { gte: thirtyDaysAgo, lte: now }, anonymisedAt: null },
    }),
    prisma.employee.count({
      where: { endDate: { gte: thirtyDaysAgo, lte: now }, anonymisedAt: null },
    }),
  ]);

  return {
    active: active.length,
    starters30d: starters,
    leavers30d: leavers,
    byDepartment: groupCount(active, (e) => e.department),
  };
}

async function leaveSummary(now: Date) {
  const settings = await loadLeaveSettings(currentTenantId());
  const year = leaveYearBounds(now, settings.leaveYearStart);

  const requests = await prisma.leaveRequest.findMany({
    where: { startDate: { lte: year.end }, endDate: { gte: year.start } },
    select: {
      type: true,
      status: true,
      startDate: true,
      endDate: true,
      days: true,
      employee: { select: { department: true } },
    },
  });

  let annualUsed = 0;
  let sickUsed = 0;
  let pending = 0;
  const byDepartment = new Map<string, number>();

  for (const request of requests) {
    if (request.status === 'PENDING') pending += 1;
    if (request.status !== 'APPROVED') continue;
    const days = requestDays(request, settings);
    if (request.type === 'ANNUAL') annualUsed += days;
    if (request.type === 'SICK') {
      sickUsed += days;
      const department = request.employee?.department || 'Unassigned';
      byDepartment.set(department, (byDepartment.get(department) ?? 0) + days);
    }
  }

  return {
    leaveYear: {
      label: year.label,
      start: toIsoDate(year.start),
      end: toIsoDate(year.end),
    },
    pending,
    annualUsed,
    sickUsed,
    sickByDepartment: [...byDepartment.entries()]
      .map(([name, days]) => ({ name, days }))
      .sort((a, b) => b.days - a.days),
  };
}

async function expirySummary(now: Date) {
  const items = await collectTenantExpiringItems(now, Math.max(...EXPIRY_BUCKETS));
  const byKind = new Map<string, { overdue: number; [bucket: string]: number }>();

  for (const item of items) {
    const entry = byKind.get(item.kind) ?? {
      overdue: 0,
      ...Object.fromEntries(EXPIRY_BUCKETS.map((b) => [String(b), 0])),
    };
    if (item.daysRemaining < 0) entry.overdue += 1;
    else {
      const bucket = EXPIRY_BUCKETS.find((b) => item.daysRemaining <= b);
      if (bucket) entry[String(bucket)] += 1;
    }
    byKind.set(item.kind, entry);
  }

  return {
    buckets: EXPIRY_BUCKETS,
    total: items.length,
    overdue: items.filter((i) => i.daysRemaining < 0).length,
    byKind: [...byKind.entries()].map(([kind, counts]) => ({ kind, ...counts })),
  };
}

async function timesheetSummary(now: Date) {
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const monthEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
  );

  const entries = await prisma.timesheet.findMany({
    where: { date: { gte: monthStart, lte: monthEnd } },
    select: { hours: true, project: { select: { name: true } } },
  });

  const byProject = new Map<string, number>();
  let hours = 0;
  for (const entry of entries) {
    hours += entry.hours;
    const name = entry.project?.name || 'No project';
    byProject.set(name, (byProject.get(name) ?? 0) + entry.hours);
  }

  return {
    monthStart: toIsoDate(monthStart),
    hours: Math.round(hours * 100) / 100,
    entries: entries.length,
    byProject: [...byProject.entries()]
      .map(([name, projectHours]) => ({
        name,
        hours: Math.round(projectHours * 100) / 100,
      }))
      .sort((a, b) => b.hours - a.hours),
  };
}

// The rest of the HR file, as counts. Cases are deliberately a bare number:
// even a director's dashboard should not name who has a live grievance.
async function hrFileSummary(now: Date) {
  const in30Days = addUtcDays(now, 30);
  const [reviewsDue, reviewsOverdue, onboarding, expenses, openCases] =
    await Promise.all([
      prisma.performanceReview.count({
        where: { completedAt: null, dueDate: { gte: now, lte: in30Days } },
      }),
      prisma.performanceReview.count({
        where: { completedAt: null, dueDate: { lt: now } },
      }),
      prisma.checklistItem.count({
        where: { completedAt: null, kind: 'ONBOARDING' },
      }),
      prisma.expenseClaim.findMany({
        where: { status: 'PENDING' },
        select: { amount: true },
      }),
      prisma.caseRecord.count({ where: { closedAt: null } }),
    ]);

  return {
    reviewsDue30d: reviewsDue,
    reviewsOverdue,
    onboardingOutstanding: onboarding,
    expensesPending: expenses.length,
    expensesPendingValue:
      Math.round(expenses.reduce((sum, e) => sum + e.amount, 0) * 100) / 100,
    openCases,
  };
}

router.get(
  '/summary',
  requireAuth,
  requireRole('ADMIN', 'DIRECTOR'),
  async (req: any, res) => {
    try {
      const now = new Date();
      const compliance = await complianceEnabled();
      const [headcount, leave, expiries, timesheets, hrFile, readiness] =
        await Promise.all([
          headcountSummary(now),
          leaveSummary(now),
          expirySummary(now),
          timesheetSummary(now),
          hrFileSummary(now),
          compliance ? computeAuditReadiness(now) : Promise.resolve(null),
        ]);

      await auditLog(req, 'READ', 'Report', undefined, { report: 'summary' });
      res.json({
        generatedAt: now,
        headcount,
        leave,
        expiries,
        timesheets,
        hrFile,
        readiness,
      });
    } catch (e: any) {
      console.error('Error building report summary:', e);
      res.status(500).json({ error: e.message });
    }
  },
);

const EXPORTS: Record<string, (now: Date) => Promise<any[]>> = {
  headcount: async () => {
    const employees = await prisma.employee.findMany({
      where: { anonymisedAt: null },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        jobTitle: true,
        department: true,
        employeeType: true,
        startDate: true,
        endDate: true,
        manager: { select: { firstName: true, lastName: true } },
      },
      orderBy: { lastName: 'asc' },
    });
    return employees.map((e: any) => ({
      'First name': e.firstName,
      'Last name': e.lastName,
      Email: e.email,
      'Job title': e.jobTitle || '',
      Department: e.department || '',
      Type: e.employeeType,
      Started: e.startDate ? toIsoDate(e.startDate) : '',
      Left: e.endDate ? toIsoDate(e.endDate) : '',
      'Reports to': e.manager
        ? `${e.manager.firstName} ${e.manager.lastName}`
        : '',
    }));
  },

  leave: async () => {
    const requests = await prisma.leaveRequest.findMany({
      include: { employee: { select: { firstName: true, lastName: true, department: true } } },
      orderBy: { startDate: 'desc' },
    });
    return requests.map((r: any) => ({
      Employee: `${r.employee.firstName} ${r.employee.lastName}`,
      Department: r.employee.department || '',
      Type: r.type,
      From: toIsoDate(r.startDate),
      To: toIsoDate(r.endDate),
      'Working days': r.days,
      Status: r.status,
      'Decided by': r.decidedBy || '',
      'Decided at': r.decidedAt ? toIsoDate(r.decidedAt) : '',
      Reason: r.reason || '',
    }));
  },

  absence: async () => {
    const records = await prisma.absenceRecord.findMany({
      include: { employee: { select: { firstName: true, lastName: true, department: true } } },
      orderBy: { date: 'desc' },
    });
    return records.map((a: any) => ({
      Employee: `${a.employee.firstName} ${a.employee.lastName}`,
      Department: a.employee.department || '',
      Date: toIsoDate(a.date),
      Status: a.status,
      Source: a.source,
      Notes: a.notes || '',
    }));
  },

  expiries: async (now: Date) => {
    const items = await collectTenantExpiringItems(now, 365);
    return items.map((i) => ({
      What: i.label,
      Who: i.employeeName || 'Sponsor licence',
      Detail: i.detail || '',
      Due: toIsoDate(i.expiryDate),
      'Days remaining': i.daysRemaining,
    }));
  },

  timesheets: async () => {
    const entries = await prisma.timesheet.findMany({
      include: {
        employee: { select: { firstName: true, lastName: true } },
        project: { select: { name: true } },
      },
      orderBy: { date: 'desc' },
    });
    return entries.map((t: any) => ({
      Employee: `${t.employee.firstName} ${t.employee.lastName}`,
      Date: toIsoDate(t.date),
      Project: t.project?.name || 'No project',
      Hours: t.hours,
      Notes: t.notes || '',
    }));
  },
};

const MAX_EXPORT_ROWS = 50000;

router.get(
  '/export/:report',
  requireAuth,
  requireRole('ADMIN', 'DIRECTOR'),
  async (req: any, res) => {
    const name = String(req.params.report);
    const build = EXPORTS[name];
    if (!build)
      return res.status(404).json({
        error: `Unknown report. Available: ${Object.keys(EXPORTS).join(', ')}`,
      });

    try {
      const rows = (await build(new Date())).slice(0, MAX_EXPORT_ROWS);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(rows.length ? rows : [{}]),
        name.slice(0, 31),
      );
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      await auditLog(req, 'EXPORT', 'Report', undefined, {
        report: name,
        rows: rows.length,
      });

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=${name}-${toIsoDate(new Date())}.xlsx`,
      );
      res.send(buffer);
    } catch (e: any) {
      console.error(`Error exporting ${name}:`, e);
      res.status(500).json({ error: e.message });
    }
  },
);

export default router;
