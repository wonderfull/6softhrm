import { Router } from 'express';
import prisma from '../prismaClient';
import { requireAuth } from '../middleware/auth';
import { auditLog } from '../middleware/audit';
import { sendEmail, EmailTemplates } from '../lib/emailService';
import { canReviewLeaveAndTime, normalizeRole, ROLES } from '../lib/roles';
import { currentTenantId } from '../lib/tenantContext';
import { loadLeaveSettings, loadWorkingDayConfig } from '../lib/tenantSettings';
import { canDecideLeave, directReportIds } from '../lib/reportingLine';
import { notifyRoles, notifyUsers } from '../lib/notify';
import {
  LEAVE_TYPES,
  LeaveBalance,
  LeaveSettings,
  computeBalance,
  isLeaveType,
  leaveYearBounds,
} from '../lib/leave';
import {
  addUtcDays,
  countWorkingDays,
  isBankHoliday,
  toIsoDate,
  toUtcMidnight,
} from '../lib/workingDays';

const router = Router();

const ELEVATED = ['ADMIN', 'DIRECTOR', 'OFFICE_ASSISTANT'];

const parseDate = (value: unknown) => {
  if (!value) return null;
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? null : date;
};

const employeeName = (employee: { firstName: string; lastName: string }) =>
  `${employee.firstName} ${employee.lastName}`;

/**
 * The balance for one employee, including what carried over from last year.
 * Last year is scored with no carry-in of its own — we do not chain the
 * calculation back through every year the person has worked here.
 */
async function balanceFor(
  employeeId: number,
  reference: Date,
  settings: LeaveSettings,
): Promise<LeaveBalance | null> {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId },
    select: {
      startDate: true,
      endDate: true,
      leaveAllowanceDays: true,
      leaveCarriedOverDays: true,
    },
  });
  if (!employee) return null;

  const year = leaveYearBounds(reference, settings.leaveYearStart);
  const previous = leaveYearBounds(
    addUtcDays(year.start, -1),
    settings.leaveYearStart,
  );

  const requests = await prisma.leaveRequest.findMany({
    where: {
      employeeId,
      startDate: { lte: year.end },
      endDate: { gte: previous.start },
      status: { not: 'REJECTED' },
    },
    select: {
      type: true,
      status: true,
      startDate: true,
      endDate: true,
      days: true,
    },
  });

  const lastYear = computeBalance({
    reference: previous.start,
    settings,
    employee: { ...employee, leaveCarriedOverDays: null },
    requests,
  });

  return computeBalance({
    reference,
    settings,
    employee,
    requests,
    unusedLastYear: Math.max(0, lastYear.prorated - lastYear.used),
  });
}

// Working days a date range consumes on this tenant's calendar. The form calls
// this as the user picks dates so the count they see is the count that is
// stored.
router.get('/days', requireAuth, async (req: any, res) => {
  const start = parseDate(req.query.start);
  const end = parseDate(req.query.end);
  if (!start || !end)
    return res.status(400).json({ error: 'start and end are required' });
  if (end < start)
    return res
      .status(400)
      .json({ error: 'End date cannot be before start date' });

  const config = await loadWorkingDayConfig(currentTenantId());
  res.json({ days: countWorkingDays(start, end, config) });
});

// Own balance, or a colleague's for anyone who reviews leave.
router.get('/balance', requireAuth, async (req: any, res) => {
  const user = req.user;
  const role = normalizeRole(user.role);
  const requested = req.query.employeeId
    ? Number(req.query.employeeId)
    : user.employeeId;

  if (!requested)
    return res
      .status(400)
      .json({ error: 'User account is not linked to an employee record' });
  if (requested !== user.employeeId && !canReviewLeaveAndTime(role)) {
    const reports = user.employeeId
      ? await directReportIds(user.employeeId)
      : [];
    if (!reports.includes(requested))
      return res.status(403).json({ error: 'Unauthorized' });
  }

  const settings = await loadLeaveSettings(currentTenantId());
  const reference = req.query.year
    ? new Date(Date.UTC(Number(req.query.year), 6, 1))
    : new Date();
  const balance = await balanceFor(requested, reference, settings);
  if (!balance) return res.status(404).json({ error: 'Employee not found' });
  res.json(balance);
});

// Who is off, between two dates. Everyone can see that a colleague is away —
// nobody outside their line sees why, because sick leave is not company news.
router.get('/calendar', requireAuth, async (req: any, res) => {
  const user = req.user;
  const role = normalizeRole(user.role);
  const from = parseDate(req.query.from);
  const to = parseDate(req.query.to);
  if (!from || !to)
    return res.status(400).json({ error: 'from and to are required' });
  if (to < from)
    return res.status(400).json({ error: 'to cannot be before from' });

  const department = req.query.department
    ? String(req.query.department)
    : undefined;

  const requests = await prisma.leaveRequest.findMany({
    where: {
      status: 'APPROVED',
      startDate: { lte: to },
      endDate: { gte: from },
      ...(department ? { employee: { department } } : {}),
    },
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          department: true,
          managerId: true,
          anonymisedAt: true,
        },
      },
    },
    orderBy: { startDate: 'asc' },
  });

  const elevated = canReviewLeaveAndTime(role);
  const entries = requests
    .filter((request: any) => !request.employee.anonymisedAt)
    .map((request: any) => {
      const mine = user.employeeId === request.employeeId;
      const reportsToMe =
        Boolean(user.employeeId) &&
        request.employee.managerId === user.employeeId;
      const canSeeType = mine || elevated || reportsToMe;
      return {
        id: request.id,
        employeeId: request.employeeId,
        employeeName: employeeName(request.employee),
        department: request.employee.department,
        type: canSeeType ? request.type : 'LEAVE',
        startDate: request.startDate,
        endDate: request.endDate,
        status: request.status,
      };
    });

  const config = await loadWorkingDayConfig(currentTenantId());
  const bankHolidays: string[] = [];
  for (
    let cursor = toUtcMidnight(from);
    cursor.getTime() <= toUtcMidnight(to).getTime();
    cursor = addUtcDays(cursor, 1)
  ) {
    if (isBankHoliday(cursor, config.bankHolidayRegion))
      bankHolidays.push(toIsoDate(cursor));
  }

  res.json({ from: toIsoDate(from), to: toIsoDate(to), entries, bankHolidays });
});

router.get('/', requireAuth, async (req: any, res) => {
  const user = req.user;
  const role = normalizeRole(user.role);

  if (!canReviewLeaveAndTime(role)) {
    if (!user.employeeId) {
      return res.json([]);
    }
    // A line manager sees their reports' requests without being an HR admin.
    const visible = [
      user.employeeId,
      ...(await directReportIds(user.employeeId)),
    ];
    const leaves = await prisma.leaveRequest.findMany({
      where: { employeeId: { in: visible } },
      include: { employee: true },
    });
    return res.json(leaves);
  }

  const leaves = await prisma.leaveRequest.findMany({
    include: { employee: true },
  });
  res.json(leaves);
});

router.post('/', requireAuth, async (req: any, res) => {
  const user = req.user;
  const role = normalizeRole(user.role);
  let { employeeId, type, startDate, endDate, reason } = req.body;

  if (role === ROLES.EMPLOYEE) {
    if (!user.employeeId) {
      return res
        .status(403)
        .json({ error: 'User account is not linked to an employee record' });
    }
    employeeId = user.employeeId;
  } else if (!canReviewLeaveAndTime(role)) {
    return res.status(403).json({ error: 'Unauthorized' });
  } else if (!employeeId && user.employeeId) {
    employeeId = user.employeeId;
  }

  if (!employeeId || !type || !startDate || !endDate)
    return res.status(400).json({ error: 'missing fields' });
  if (!isLeaveType(type))
    return res
      .status(400)
      .json({ error: `type must be one of ${LEAVE_TYPES.join(', ')}` });

  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start || !end)
    return res.status(400).json({ error: 'startDate and endDate must be dates' });
  if (end < start)
    return res
      .status(400)
      .json({ error: 'End date cannot be before start date' });

  try {
    const settings = await loadLeaveSettings(currentTenantId());
    const days = countWorkingDays(start, end, settings);
    if (days === 0)
      return res
        .status(400)
        .json({ error: 'Leave must cover at least one working day' });

    // Two requests over the same day is almost always a mis-click, and it
    // would double-count against the allowance.
    const clash = await prisma.leaveRequest.findFirst({
      where: {
        employeeId,
        status: { not: 'REJECTED' },
        startDate: { lte: end },
        endDate: { gte: start },
      },
      select: { id: true },
    });
    if (clash)
      return res
        .status(409)
        .json({ error: 'That overlaps a leave request you already have' });

    if (type === 'ANNUAL') {
      const balance = await balanceFor(employeeId, start, settings);
      if (balance && days > balance.remaining)
        return res.status(409).json({
          error: `Not enough annual leave remaining (${balance.remaining} days left, ${days} requested)`,
          remaining: balance.remaining,
          requested: days,
        });
    }

    const lr = await prisma.leaveRequest.create({
      data: {
        tenantId: currentTenantId(),
        employeeId,
        type,
        startDate: start,
        endDate: end,
        days,
        reason,
      },
      include: { employee: true },
    });
    await auditLog(req, 'CREATE', 'LeaveRequest', lr.id, {
      employeeId,
      type,
      startDate,
      endDate,
      days,
    });

    try {
      const name = employeeName(lr.employee);
      const template = EmailTemplates.leaveRequestPending(
        name,
        lr.type,
        toIsoDate(lr.startDate),
        toIsoDate(lr.endDate),
        lr.id,
      );
      const notification = {
        type: 'LEAVE',
        title: `${name} requested ${days} day${days === 1 ? '' : 's'} leave`,
        body: `${lr.type} from ${toIsoDate(lr.startDate)} to ${toIsoDate(lr.endDate)}`,
        link: '/leave',
        email: { subject: template.subject, html: template.html },
      };

      // The line manager decides it, so the line manager is told. With no
      // manager on file it falls back to whoever reviews leave.
      const manager = lr.employee.managerId
        ? await prisma.user.findFirst({
            where: { employeeId: lr.employee.managerId },
            select: { id: true },
          })
        : null;
      if (manager) await notifyUsers([manager.id], notification);
      else await notifyRoles(ELEVATED, notification);
    } catch (notifyError) {
      console.error('Failed to send leave request notification:', notifyError);
    }

    res.json(lr);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Approve/reject share one path: only a PENDING request can be decided (a
// second decision on the same request is a 409, not a silent overwrite), and
// nobody decides their own leave whatever their role.
async function decideLeave(
  req: any,
  res: any,
  status: 'APPROVED' | 'REJECTED',
) {
  const id = Number(req.params.id);
  try {
    const existing = await prisma.leaveRequest.findFirst({
      where: { id },
      include: { employee: { select: { managerId: true } } },
    });
    if (!existing)
      return res.status(404).json({ error: 'Leave request not found' });
    if (req.user.employeeId && existing.employeeId === req.user.employeeId)
      return res
        .status(403)
        .json({ error: 'You cannot decide your own leave request' });
    if (!canDecideLeave(req.user, existing))
      return res.status(403).json({ error: 'Unauthorized' });
    if (existing.status !== 'PENDING')
      return res.status(409).json({
        error: `Leave request already ${existing.status.toLowerCase()}`,
      });

    const note = req.body?.note ?? req.body?.reason;
    const updated = await prisma.leaveRequest.updateMany({
      where: { id, status: 'PENDING' },
      data: {
        status,
        decidedAt: new Date(),
        decidedBy: req.user?.email ?? null,
        decisionNote: note ? String(note) : null,
      },
    });
    if (updated.count === 0)
      return res.status(409).json({ error: 'Leave request already decided' });
    const lr = await prisma.leaveRequest.findFirst({
      where: { id },
      include: { employee: true },
    });
    if (!lr) return res.status(404).json({ error: 'Leave request not found' });

    await auditLog(
      req,
      status === 'APPROVED' ? 'APPROVE' : 'REJECT',
      'LeaveRequest',
      id,
      {
        employeeId: lr.employeeId,
        reason: note,
      },
    );

    try {
      const name = employeeName(lr.employee);
      const start = toIsoDate(lr.startDate);
      const end = toIsoDate(lr.endDate);
      const template =
        status === 'APPROVED'
          ? EmailTemplates.leaveRequestApproved(name, lr.type, start, end)
          : EmailTemplates.leaveRequestRejected(
              name,
              lr.type,
              start,
              end,
              note || 'No reason provided',
            );

      const account = await prisma.user.findFirst({
        where: { employeeId: lr.employeeId },
        select: { id: true },
      });
      const notification = {
        type: 'LEAVE',
        title: `Leave ${status === 'APPROVED' ? 'approved' : 'rejected'}: ${start} to ${end}`,
        body: note ? String(note) : undefined,
        link: '/leave',
        email: { subject: template.subject, html: template.html },
      };
      if (account) await notifyUsers([account.id], notification);
      else if (lr.employee.email)
        await sendEmail({
          to: lr.employee.email,
          subject: template.subject,
          html: template.html,
        });
    } catch (emailError) {
      console.error('Failed to send leave decision notification:', emailError);
    }

    res.json(lr);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

router.put('/:id/approve', requireAuth, (req, res) =>
  decideLeave(req, res, 'APPROVED'),
);

router.put('/:id/reject', requireAuth, (req, res) =>
  decideLeave(req, res, 'REJECTED'),
);

// Withdraw a request. Your own while it is still pending; a reviewer may
// remove any of them.
router.delete('/:id', requireAuth, async (req: any, res) => {
  const id = Number(req.params.id);
  const user = req.user;
  const elevated = canReviewLeaveAndTime(normalizeRole(user.role));

  const existing = await prisma.leaveRequest.findFirst({ where: { id } });
  if (!existing)
    return res.status(404).json({ error: 'Leave request not found' });

  const own = Boolean(user.employeeId) && existing.employeeId === user.employeeId;
  if (!elevated && !own)
    return res.status(403).json({ error: 'Unauthorized' });
  if (!elevated && existing.status !== 'PENDING')
    return res
      .status(409)
      .json({ error: 'Only a pending request can be withdrawn' });

  await prisma.leaveRequest.deleteMany({ where: { id } });
  await auditLog(req, 'DELETE', 'LeaveRequest', id, {
    employeeId: existing.employeeId,
    status: existing.status,
  });
  res.json({ success: true });
});

export default router;
